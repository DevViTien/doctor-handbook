import "server-only";

import { eq } from "drizzle-orm";

import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts } from "@/server/db/schema";

/** Records a successful login (`accounts.last_login_at`, shown to the admin). */
export async function recordLoginSuccess(
  accountId: string,
  now: Date = new Date(),
  db: DbExecutor = getDb(),
): Promise<void> {
  await db.update(accounts).set({ lastLoginAt: now }).where(eq(accounts.id, accountId));
}
