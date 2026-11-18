import "server-only";

import { eq, sql } from "drizzle-orm";

import { usableActivationCode } from "@/modules/auth/server/queries";
import { createSession } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { accessCodes, accounts } from "@/server/db/schema";

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
