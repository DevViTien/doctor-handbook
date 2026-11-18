import "server-only";

import { and, eq } from "drizzle-orm";

import type { AccountStatus } from "@/lib/enums";
import { accessCodeIsUsable } from "@/server/auth/access-codes";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accessCodes, accounts } from "@/server/db/schema";

export type LoginAccount = {
  id: string;
  role: (typeof accounts.$inferSelect)["role"];
  status: (typeof accounts.$inferSelect)["status"];
  passwordHash: string;
};

/**
 * The account behind a login attempt, by normalized (lowercase) username. Selects only what
 * the login flow needs; the password hash never leaves the auth module.
 */
export async function findAccountForLogin(
  username: string,
  db: DbExecutor = getDb(),
): Promise<LoginAccount | null> {
  const [account] = await db
    .select({
      id: accounts.id,
      role: accounts.role,
      status: accounts.status,
      passwordHash: accounts.passwordHash,
    })
    .from(accounts)
    .where(eq(accounts.username, username))
    .limit(1);

  return account ?? null;
}

/**
 * A usable activation code by its hash: activation type, unused, unrevoked, unexpired. One
 * combined condition, so the caller cannot tell (nor reveal) why a code is unusable.
 */
export async function findUsableActivationCode(
  codeHash: string,
  db: DbExecutor = getDb(),
): Promise<{ recipientName: string; expiresAt: Date } | null> {
  const [code] = await db
    .select({ recipientName: accessCodes.recipientName, expiresAt: accessCodes.expiresAt })
    .from(accessCodes)
    .where(usableActivationCode(codeHash))
    .limit(1);
  return code ?? null;
}

/** Shared by the check (step 1) and the consuming UPDATE (step 2). */
export function usableActivationCode(codeHash: string) {
  return and(
    eq(accessCodes.codeHash, codeHash),
    eq(accessCodes.type, "activation"),
    accessCodeIsUsable(),
  );
}

/** Whether a username is already taken (by a doctor or the admin). */
export async function usernameExists(username: string, db: DbExecutor = getDb()): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.username, username))
    .limit(1);
  return Boolean(row);
}

/** A usable password-reset code by its hash, with the username of the account it is for. */
export async function findUsablePasswordResetCode(
  codeHash: string,
  db: DbExecutor = getDb(),
): Promise<{ username: string; expiresAt: Date; accountStatus: AccountStatus } | null> {
  const [code] = await db
    .select({
      username: accounts.username,
      expiresAt: accessCodes.expiresAt,
      accountStatus: accounts.status,
    })
    .from(accessCodes)
    .innerJoin(accounts, eq(accessCodes.accountId, accounts.id))
    .where(usablePasswordResetCode(codeHash))
    .limit(1);
  return code ?? null;
}

/** Shared by the check (step 1) and the consuming UPDATE (step 2). */
export function usablePasswordResetCode(codeHash: string) {
  return and(
    eq(accessCodes.codeHash, codeHash),
    eq(accessCodes.type, "password_reset"),
    accessCodeIsUsable(),
  );
}

/** The password hash of an account, for re-checking the current password. Never leaves auth. */
export async function findPasswordHash(
  accountId: string,
  db: DbExecutor = getDb(),
): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: accounts.passwordHash })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row?.passwordHash ?? null;
}
