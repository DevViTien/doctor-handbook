import "server-only";

import { eq } from "drizzle-orm";

import { countRecentAttempts, forgetAttempts, recordAttempts } from "@/server/auth/attempts";
import {
  CODE_ENTRY_MAX_FAILURES_PER_IP,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_MAX_FAILURES_PER_USERNAME,
} from "@/server/auth/constants";
import { sha256Hex } from "@/server/auth/crypto";
import { type DbExecutor, getDb } from "@/server/db/client";
import { authAttempts } from "@/server/db/schema";
import { UNKNOWN_CLIENT_IP } from "@/server/http/client-ip";

/**
 * Login rate limiting (design §4 of add-account-login) on top of the shared attempt
 * bookkeeping in `src/server/auth/attempts.ts` (record-then-count, sliding window).
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
export function recordLoginAttempt(keys: LoginAttemptKeys): Promise<number[]> {
  return recordAttempts(activeKeys(keys));
}

/** Attempts for both keys within the window (including the current one), in one query. */
export async function countRecentLoginAttempts(
  keys: LoginAttemptKeys,
  now: Date = new Date(),
): Promise<LoginAttemptCounts> {
  const counts = await countRecentAttempts(activeKeys(keys), LOGIN_FAILURE_WINDOW_MS, now);
  return {
    username: counts.get(keys.username) ?? 0,
    ip: keys.ip ? (counts.get(keys.ip) ?? 0) : 0,
  };
}

/** Removes the rows of an attempt that must not count as a failure (refused or successful). */
export function forgetLoginAttempt(attemptIds: number[]): Promise<void> {
  return forgetAttempts(attemptIds);
}

/** A successful login forgives that username's earlier failures (not the IP's). */
export async function clearUsernameFailures(
  keys: LoginAttemptKeys,
  db: DbExecutor = getDb(),
): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, keys.username));
}

/**
 * Activation-code entry (spec account-activation): one hashed per-IP key. An unknown IP hashes
 * to one shared bucket on purpose: with no other key, "no limit" would allow unlimited guessing.
 */
export function codeAttemptKey(ip: string): string {
  return `code:ip:${sha256Hex(ip)}`;
}

/** Blocked once the current code entry goes beyond the allowed number of failures. */
export function isCodeEntryBlocked(attempts: number): boolean {
  return attempts > CODE_ENTRY_MAX_FAILURES_PER_IP;
}
