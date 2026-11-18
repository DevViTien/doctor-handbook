import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { usableActivationCode, usablePasswordResetCode } from "@/modules/auth/server/queries";
import { createSession, invalidateAccountSessions } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { accessCodes, accounts, sessions } from "@/server/db/schema";

/** Records a successful login (`accounts.last_login_at`, shown to the admin). */
export async function recordLoginSuccess(
  accountId: string,
  now: Date = new Date(),
  db: DbExecutor = getDb(),
): Promise<void> {
  await db.update(accounts).set({ lastLoginAt: now }).where(eq(accounts.id, accountId));
}

export type ActivationResult =
  | { status: "created"; accountId: string; sessionToken: string }
  | { status: "invalid-code" }
  | { status: "username-taken" };

/** Thrown inside the transaction to roll it back; never leaves this module. */
class UsernameTakenError extends Error {}

/**
 * Consumes an activation code and creates the doctor account plus its first session, all in one
 * transaction (design §3):
 *
 * 1. A conditional `UPDATE … RETURNING` marks the code used only if it is still usable. A
 *    concurrent submission waits on the row lock, re-checks the condition after the first
 *    commits and updates nothing: one code creates at most one account.
 * 2. Insert the account. A taken username rolls everything back, so the code stays usable.
 * 3. Link the code to the account, create the session.
 */
export async function activateAccountWithCode(
  input: {
    codeHash: string;
    displayName: string;
    username: string;
    passwordHash: string;
    userAgent: string | null;
  },
  db: DbExecutor = getDb(),
): Promise<ActivationResult> {
  try {
    return await db.transaction(async (tx): Promise<ActivationResult> => {
      const [code] = await tx
        .update(accessCodes)
        .set({ usedAt: sql`now()` })
        .where(usableActivationCode(input.codeHash))
        .returning({ id: accessCodes.id });
      if (!code) return { status: "invalid-code" };

      let accountId: string;
      try {
        const [account] = await tx
          .insert(accounts)
          .values({
            role: "doctor",
            status: "active",
            username: input.username,
            displayName: input.displayName,
            passwordHash: input.passwordHash,
            termsAcceptedAt: sql`now()`,
            lastLoginAt: sql`now()`,
          })
          .returning({ id: accounts.id });
        if (!account) throw new Error("account insert returned no row");
        accountId = account.id;
      } catch (error) {
        if (isUniqueViolation(error, "accounts_username_key")) throw new UsernameTakenError();
        throw error;
      }

      await tx.update(accessCodes).set({ accountId }).where(eq(accessCodes.id, code.id));
      const session = await createSession(accountId, { userAgent: input.userAgent }, tx);
      if (!session) throw new Error("new account has no session (not active?)");
      return { status: "created", accountId, sessionToken: session.token };
    });
  } catch (error) {
    if (error instanceof UsernameTakenError) return { status: "username-taken" };
    throw error;
  }
}

export type PasswordResetResult =
  | { status: "reset"; accountId: string; sessionToken: string }
  | { status: "invalid-code" }
  | { status: "account-locked" };

/**
 * Consumes a password-reset code and sets the new password, in one transaction (design §2).
 *
 * Lock order is account row first, then code rows — the same order as the admin issuing a reset
 * code (`issuePasswordResetCode`) and locking an account — so these never deadlock:
 *
 * 1. Find the account of the usable code, then lock that account row (`FOR UPDATE`). Only an
 *    ACTIVE doctor account goes on; a locked one changes nothing (the code stays usable).
 * 2. A conditional `UPDATE … RETURNING` consumes the code only if it is still usable: with the
 *    account row held, a concurrent submission of the same code finds it used.
 * 3. Set the password, end every session of the account (idea.md §8.3), open this device's.
 */
export async function resetPasswordWithCode(
  input: { codeHash: string; passwordHash: string; userAgent: string | null },
  db: DbExecutor = getDb(),
): Promise<PasswordResetResult> {
  return db.transaction(async (tx): Promise<PasswordResetResult> => {
    const [target] = await tx
      .select({ accountId: accessCodes.accountId })
      .from(accessCodes)
      .where(usablePasswordResetCode(input.codeHash))
      .limit(1);
    if (!target?.accountId) return { status: "invalid-code" };
    const accountId = target.accountId;

    const [account] = await tx
      .select({ status: accounts.status })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.role, "doctor")))
      .for("update");
    if (!account) return { status: "invalid-code" };
    if (account.status !== "active") return { status: "account-locked" };

    const [code] = await tx
      .update(accessCodes)
      .set({ usedAt: sql`now()` })
      .where(and(usablePasswordResetCode(input.codeHash), eq(accessCodes.accountId, accountId)))
      .returning({ id: accessCodes.id });
    if (!code) return { status: "invalid-code" };

    await tx
      .update(accounts)
      .set({ passwordHash: input.passwordHash, lastLoginAt: sql`now()` })
      .where(eq(accounts.id, accountId));
    await invalidateAccountSessions(accountId, {}, tx);

    // The account row is held and active in this transaction, so a session is always created.
    const session = await createSession(accountId, { userAgent: input.userAgent }, tx);
    if (!session) throw new Error("active account without a session");
    return { status: "reset", accountId, sessionToken: session.token };
  });
}

export type PasswordChangeResult = "changed" | "locked" | "session-ended" | "stale";

/**
 * Sets a new password hash and ends every session of the account except `keepSessionId` (this
 * device), in one transaction (idea.md §8.3). The account row is locked first (`FOR UPDATE`,
 * same order as reset and lock), then the write only happens if, at that moment:
 * - the account is still active ("locked" otherwise),
 * - this device's session still exists ("session-ended" otherwise: it was signed out),
 * - the stored hash is still the one the current password was verified against ("stale"
 *   otherwise: a reset or another change happened meanwhile and must not be overwritten).
 */
export async function changePasswordHash(
  input: { accountId: string; verifiedHash: string; newHash: string; keepSessionId: string },
  db: DbExecutor = getDb(),
): Promise<PasswordChangeResult> {
  return db.transaction(async (tx): Promise<PasswordChangeResult> => {
    const [account] = await tx
      .select({ status: accounts.status, passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(accounts.id, input.accountId))
      .for("update");
    if (!account || account.status !== "active") return "locked";

    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, input.keepSessionId), eq(sessions.accountId, input.accountId)))
      .limit(1);
    if (!session) return "session-ended";
    if (account.passwordHash !== input.verifiedHash) return "stale";

    await tx
      .update(accounts)
      .set({ passwordHash: input.newHash })
      .where(eq(accounts.id, input.accountId));
    await invalidateAccountSessions(input.accountId, { exceptSessionId: input.keepSessionId }, tx);
    return "changed";
  });
}
