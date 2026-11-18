import "server-only";

import { AppError } from "@/lib/errors";
import { LOGIN_MESSAGES, RESET_MESSAGES } from "@/modules/auth/constants";
import { withCodeEntry } from "@/modules/auth/server/code-entry";
import { resetPasswordWithCode } from "@/modules/auth/server/mutations";
import { findUsablePasswordResetCode } from "@/modules/auth/server/queries";
import { hashAccessCode } from "@/server/auth/crypto";
import { hashPassword } from "@/server/auth/password";

/**
 * Password reset with an admin-issued code (spec password-reset, design §2). Knows nothing about
 * cookies or redirects. Code entries share the activation rate limit (`withCodeEntry`).
 */

export type PasswordResetCodeInfo = { username: string; expiresAt: Date };

/** A locked account cannot reset its password (the admin unlocks it first, idea.md §8.3). */
function accountLocked(): AppError {
  return new AppError("FORBIDDEN", LOGIN_MESSAGES.accountLocked);
}

/**
 * Step 1: is this a usable password-reset code? Returns the username it was issued for.
 * @throws AppError RATE_LIMITED | NOT_FOUND (unusable code: the attempt stays a failure)
 */
export function checkPasswordResetCode(input: {
  code: string;
  ip: string;
}): Promise<PasswordResetCodeInfo> {
  return withCodeEntry(input.ip, RESET_MESSAGES.invalidCode, async (unusableCode) => {
    const found = await findUsablePasswordResetCode(hashAccessCode(input.code));
    if (!found) throw unusableCode();
    // Say it now rather than after the doctor has typed a new password.
    if (found.accountStatus !== "active") throw accountLocked();
    return { username: found.username, expiresAt: found.expiresAt };
  });
}

/**
 * Step 2: sets the new password, ends every session of the account and opens one for this
 * device. The code is checked (cheaply) before the slow Argon2 hash, and again in the
 * transaction. Returns the new session token.
 * @throws AppError RATE_LIMITED | NOT_FOUND (unusable code) | FORBIDDEN (account locked)
 */
export function resetPassword(input: {
  code: string;
  password: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ accountId: string; sessionToken: string }> {
  return withCodeEntry(input.ip, RESET_MESSAGES.invalidCode, async (unusableCode) => {
    const codeHash = hashAccessCode(input.code);
    const found = await findUsablePasswordResetCode(codeHash);
    if (!found) throw unusableCode();
    if (found.accountStatus !== "active") throw accountLocked();

    const passwordHash = await hashPassword(input.password);
    const result = await resetPasswordWithCode({
      codeHash,
      passwordHash,
      userAgent: input.userAgent,
    });

    if (result.status === "invalid-code") throw unusableCode();
    if (result.status === "account-locked") throw accountLocked();
    return { accountId: result.accountId, sessionToken: result.sessionToken };
  });
}
