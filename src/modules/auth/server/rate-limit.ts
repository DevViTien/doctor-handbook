import "server-only";

import { and, count, eq, gt, inArray } from "drizzle-orm";

import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_MAX_FAILURES_PER_USERNAME,
} from "@/server/auth/constants";
import { sha256Hex } from "@/server/auth/crypto";
import { type DbExecutor, getDb } from "@/server/db/client";
import { authAttempts } from "@/server/db/schema";
import { UNKNOWN_CLIENT_IP } from "@/server/http/client-ip";

/**
 * Login rate limiting on the existing `auth_attempts` table (design §4): one row per attempt per
 * key, counted in a sliding window. No extra service, no "locked" state to clear.
 *
 * Record-then-count: an attempt is written BEFORE it is evaluated, so concurrent attempts see
 * each other and at most the threshold can get through, even when fired in parallel. Rows of an
 * attempt that turns out to be refused or successful are removed again; only failures remain.
 */

/** `ip` is null when the client address is unknown: no per-IP limit then (no shared bucket). */
export type LoginAttemptKeys = { username: string; ip: string | null };
/** Attempts in the window, INCLUDING the one being evaluated. */
export type LoginAttemptCounts = { username: number; ip: number };

/**
 * Keys are hashed so the table never stores raw usernames or IP addresses.
 * Callers pass the already-normalized (lowercase) username.
 */
export function loginAttemptKeys(username: string, ip: string): LoginAttemptKeys {
  return {
    username: `login:user:${sha256Hex(username)}`,
    ip: ip === UNKNOWN_CLIENT_IP ? null : `login:ip:${sha256Hex(ip)}`,
  };
}

/** Blocked once the current attempt goes beyond the allowed number of failures. */
export function isLoginBlocked(counts: LoginAttemptCounts): boolean {
  return counts.username > LOGIN_MAX_FAILURES_PER_USERNAME || counts.ip > LOGIN_MAX_FAILURES_PER_IP;
}

function activeKeys(keys: LoginAttemptKeys): string[] {
  return keys.ip ? [keys.username, keys.ip] : [keys.username];
}

/** Records the attempt being evaluated; returns its row ids so they can be forgotten later. */
export async function recordLoginAttempt(
  keys: LoginAttemptKeys,
  db: DbExecutor = getDb(),
): Promise<number[]> {
  const rows = await db
    .insert(authAttempts)
    .values(activeKeys(keys).map((key) => ({ key })))
    .returning({ id: authAttempts.id });
  return rows.map((row) => row.id);
}

/** Attempts for both keys within the window (including the current one), in one query. */
export async function countRecentLoginAttempts(
  keys: LoginAttemptKeys,
  now: Date = new Date(),
  db: DbExecutor = getDb(),
): Promise<LoginAttemptCounts> {
  const since = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS);
  const rows = await db
    .select({ key: authAttempts.key, attempts: count() })
    .from(authAttempts)
    .where(and(inArray(authAttempts.key, activeKeys(keys)), gt(authAttempts.createdAt, since)))
    .groupBy(authAttempts.key);

  const attemptsFor = (key: string | null) =>
    key ? (rows.find((row) => row.key === key)?.attempts ?? 0) : 0;
  return { username: attemptsFor(keys.username), ip: attemptsFor(keys.ip) };
}

/** Removes the rows of an attempt that must not count as a failure (refused or successful). */
export async function forgetLoginAttempt(
  attemptIds: number[],
  db: DbExecutor = getDb(),
): Promise<void> {
  if (attemptIds.length === 0) return;
  await db.delete(authAttempts).where(inArray(authAttempts.id, attemptIds));
}

/** A successful login forgives that username's earlier failures (not the IP's). */
export async function clearUsernameFailures(
  keys: LoginAttemptKeys,
  db: DbExecutor = getDb(),
): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, keys.username));
}
