import "server-only";

import { eq } from "drizzle-orm";

import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts } from "@/server/db/schema";

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
