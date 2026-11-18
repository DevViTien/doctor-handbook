import "server-only";

import { AppError } from "@/lib/errors";
import { ACTIVATION_MESSAGES } from "@/modules/auth/constants";
import { withCodeEntry } from "@/modules/auth/server/code-entry";
import { activateAccountWithCode } from "@/modules/auth/server/mutations";
import { findUsableActivationCode, usernameExists } from "@/modules/auth/server/queries";
import { hashAccessCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";

/**
 * Account activation flow (spec account-activation, design §2–§4). Knows nothing about cookies
 * or redirects, so it can be unit-tested with the DAL mocked.
 *
 * Every code entry (checking a code, or submitting the account form) goes through
 * `withCodeEntry` (code-entry.ts): rate limited per IP, counted only when the code is unusable.
 */

export type ActivationCodeInfo = { recipientName: string; expiresAt: Date };

/**
 * Step 1: is this a usable activation code? Returns who it was issued for.
 * @throws AppError RATE_LIMITED | NOT_FOUND (unusable code: the attempt stays a failure)
 */
export function checkActivationCode(input: {
  code: string;
  ip: string;
}): Promise<ActivationCodeInfo> {
  return withCodeEntry(input.ip, ACTIVATION_MESSAGES.invalidCode, async (unusableCode) => {
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
  return withCodeEntry(input.ip, ACTIVATION_MESSAGES.invalidCode, async (unusableCode) => {
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
