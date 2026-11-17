import "server-only";

import { lt } from "drizzle-orm";

import { type DbExecutor, getDb } from "@/server/db/client";
import { authAttempts } from "@/server/db/schema";

import { AUTH_ATTEMPT_RETENTION_MS } from "./constants";

/**
 * Deletes failed attempts that no rate-limit window looks at any more, so a burst of
 * attempts cannot slowly fill the free-tier database. Returns the number of rows removed.
 */
export async function pruneAuthAttempts(
  now: Date = new Date(),
  db: DbExecutor = getDb(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTH_ATTEMPT_RETENTION_MS);
  const deleted = await db
    .delete(authAttempts)
    .where(lt(authAttempts.createdAt, cutoff))
    .returning({ id: authAttempts.id });
  return deleted.length;
}
