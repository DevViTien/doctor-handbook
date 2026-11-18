import "server-only";

import { AppError } from "@/lib/errors";
import { ACTIVATION_MESSAGES } from "@/modules/auth/constants";
import { activateAccountWithCode } from "@/modules/auth/server/mutations";
import { findUsableActivationCode, usernameExists } from "@/modules/auth/server/queries";
import { codeAttemptKey, isCodeEntryBlocked } from "@/modules/auth/server/rate-limit";
import { countRecentAttempts, forgetAttempts, recordAttempts } from "@/server/auth/attempts";
import { CODE_ENTRY_FAILURE_WINDOW_MS } from "@/server/auth/constants";
import { hashAccessCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";

/**
 * Account activation flow (spec account-activation, design §2–§4). Knows nothing about cookies
 * or redirects, so it can be unit-tested with the DAL mocked.
 *
 * Every code entry (checking a code, or submitting the account form) is rate limited per IP with
 * record-then-count: the attempt is kept as a failure only when the code turns out unusable.
 */

export type ActivationCodeInfo = { recipientName: string; expiresAt: Date };

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

/** Same message whatever the reason: unknown, used, revoked, expired or not an activation code. */
function invalidCode(): AppError {
  return new AppError("NOT_FOUND", ACTIVATION_MESSAGES.invalidCode);
}

/**
 * Runs one code entry: guarded by the per-IP limit, and counted as a failure ONLY when `work`
 * reports an unusable code. Anything else (success, username taken, an unexpected database or
 * hashing error) forgets the attempt, so a valid code is never locked out by our own failures.
 */
async function withCodeEntry<T>(
  ip: string,
  work: (markUnusableCode: () => AppError) => Promise<T>,
): Promise<T> {
  const attemptIds = await guardCodeEntry(ip);
  let unusableCode = false;
  try {
    return await work(() => {
      unusableCode = true;
      return invalidCode();
    });
  } finally {
    if (!unusableCode) await forgetAttempts(attemptIds);
  }
}

/**
 * Step 1: is this a usable activation code? Returns who it was issued for.
 * @throws AppError RATE_LIMITED | NOT_FOUND (unusable code: the attempt stays a failure)
 */
export function checkActivationCode(input: {
  code: string;
  ip: string;
}): Promise<ActivationCodeInfo> {
  return withCodeEntry(input.ip, async (unusableCode) => {
    const found = await findUsableActivationCode(hashAccessCode(input.code));
    if (!found) throw unusableCode();
    return found;
  });
}

function usernameTaken(): AppError {
  return new AppError("CONFLICT", ACTIVATION_MESSAGES.usernameTaken, {
    fieldErrors: { username: [ACTIVATION_MESSAGES.usernameTaken] },
  });
}

/**
 * Step 2: creates the doctor account and its first session in one transaction, consuming the
 * code (the database guarantees a code creates at most one account). Returns the session token.
 *
 * The cheap checks (code still usable, username free) run before the slow Argon2 hash, so a
 * code holder retrying taken usernames costs a query, not a hash. The transaction re-checks
 * both, which keeps concurrent submissions correct.
 *
 * @throws AppError RATE_LIMITED | NOT_FOUND (unusable code) | CONFLICT (username taken)
 */
export function activateAccount(input: {
  code: string;
  displayName: string;
  username: string;
  password: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ accountId: string; sessionToken: string }> {
  return withCodeEntry(input.ip, async (unusableCode) => {
    const codeHash = hashAccessCode(input.code);
    if (!(await findUsableActivationCode(codeHash))) throw unusableCode();
    if (await usernameExists(input.username)) throw usernameTaken();

    // Hash before the transaction: Argon2 is slow and must not run while the code row is locked.
    const passwordHash = await hashPassword(input.password);
    const result = await activateAccountWithCode({
      codeHash,
      displayName: input.displayName,
      username: input.username,
      passwordHash,
      userAgent: input.userAgent,
    });

    if (result.status === "invalid-code") throw unusableCode();
    if (result.status === "username-taken") throw usernameTaken();
    return { accountId: result.accountId, sessionToken: result.sessionToken };
  });
}
