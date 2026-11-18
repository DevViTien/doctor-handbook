import "server-only";

import { and, count, gt, inArray, lt } from "drizzle-orm";

import { type DbExecutor, getDb } from "@/server/db/client";
import { authAttempts } from "@/server/db/schema";

import { AUTH_ATTEMPT_RETENTION_MS } from "./constants";

/**
 * Rate-limit bookkeeping on the `auth_attempts` table, shared by every flow that limits
 * attempts (login, activation code entry). One row per attempt per key, counted in a sliding
 * window: no extra service and no "locked" state to clear.
 *
 * Callers use record-then-count: an attempt is written BEFORE it is evaluated, so concurrent
 * attempts see each other and at most the threshold gets through, even when fired in parallel.
 * Rows of an attempt that turns out not to be a failure are removed again with `forgetAttempts`.
 * Keys must never contain raw personal data (hash usernames and IP addresses).
 */

/** Records one attempt under each key; returns the row ids so they can be forgotten later. */
export async function recordAttempts(
  keys: readonly string[],
  db: DbExecutor = getDb(),
): Promise<number[]> {
  if (keys.length === 0) return [];
  const rows = await db
    .insert(authAttempts)
    .values(keys.map((key) => ({ key })))
    .returning({ id: authAttempts.id });
  return rows.map((row) => row.id);
}

/** Attempts per key within the window ending at `now` (keys without attempts count 0). */
export async function countRecentAttempts(
  keys: readonly string[],
  windowMs: number,
  now: Date = new Date(),
  db: DbExecutor = getDb(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(keys.map((key) => [key, 0]));
  if (keys.length === 0) return counts;

  const since = new Date(now.getTime() - windowMs);
  const rows = await db
    .select({ key: authAttempts.key, attempts: count() })
    .from(authAttempts)
    .where(and(inArray(authAttempts.key, [...keys]), gt(authAttempts.createdAt, since)))
    .groupBy(authAttempts.key);

  for (const row of rows) counts.set(row.key, row.attempts);
  return counts;
}

/** Removes the rows of an attempt that must not count as a failure (refused or successful). */
export async function forgetAttempts(
  attemptIds: readonly number[],
  db: DbExecutor = getDb(),
): Promise<void> {
  if (attemptIds.length === 0) return;
  await db.delete(authAttempts).where(inArray(authAttempts.id, [...attemptIds]));
}

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
