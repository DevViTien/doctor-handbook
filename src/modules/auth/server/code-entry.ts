import "server-only";

import { AppError } from "@/lib/errors";
import { codeAttemptKey, isCodeEntryBlocked } from "@/modules/auth/server/rate-limit";
import { countRecentAttempts, forgetAttempts, recordAttempts } from "@/server/auth/attempts";
import { CODE_ENTRY_FAILURE_WINDOW_MS } from "@/server/auth/constants";

/**
 * Shared frame for every access-code entry (activation, password reset): rate limited per IP
 * with record-then-count, one bucket for both kinds of code.
 */

/** Records the attempt and refuses it (without counting it) when the IP is over the limit. */
async function guardCodeEntry(ip: string): Promise<number[]> {
  const key = codeAttemptKey(ip);
  const attemptIds = await recordAttempts([key]);
  const counts = await countRecentAttempts([key], CODE_ENTRY_FAILURE_WINDOW_MS);

  if (isCodeEntryBlocked(counts.get(key) ?? 0)) {
    await forgetAttempts(attemptIds);
    throw new AppError("RATE_LIMITED");
  }
  return attemptIds;
}

/**
 * Runs one code entry: guarded by the per-IP limit, and counted as a failure ONLY when `work`
 * reports an unusable code (by throwing what `markUnusableCode` returns). Anything else
 * (success, a taken username, a locked account, an unexpected database or hashing error)
 * forgets the attempt, so a valid code is never locked out by our own failures.
 *
 * @param unusableCodeMessage the single message for every unusable code (never say why)
 */
export async function withCodeEntry<T>(
  ip: string,
  unusableCodeMessage: string,
  work: (markUnusableCode: () => AppError) => Promise<T>,
): Promise<T> {
  const attemptIds = await guardCodeEntry(ip);
  let unusableCode = false;
  try {
    return await work(() => {
      unusableCode = true;
      return new AppError("NOT_FOUND", unusableCodeMessage);
    });
  } finally {
    if (!unusableCode) await forgetAttempts(attemptIds);
  }
}
