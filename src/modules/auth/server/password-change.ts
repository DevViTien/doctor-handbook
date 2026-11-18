import "server-only";

import { AppError } from "@/lib/errors";
import { LOGIN_MESSAGES, PASSWORD_CHANGE_MESSAGES } from "@/modules/auth/constants";
import { changePasswordHash } from "@/modules/auth/server/mutations";
import { findPasswordHash } from "@/modules/auth/server/queries";
import {
  clearUsernameFailures,
  countRecentLoginAttempts,
  forgetLoginAttempt,
  isLoginBlocked,
  type LoginAttemptKeys,
  loginAttemptKeys,
  recordLoginAttempt,
} from "@/modules/auth/server/rate-limit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { UNKNOWN_CLIENT_IP } from "@/server/http/client-ip";

/**
 * Password change while signed in (spec password-change, design §2). Knows nothing about
 * cookies. The account and the session to keep come from the session, never from the client.
 *
 * Wrong current passwords count toward the per-USERNAME login limit only (spec), so a leaked
 * session (a phone left unlocked) gets no extra guesses, and colleagues behind the same clinic
 * IP are not affected.
 *
 * The slow Argon2 checks run outside the transaction; the transaction then re-checks that the
 * stored hash is still the verified one and that this device's session still exists, so a
 * concurrent reset or change is never overwritten (design §2).
 *
 * @throws AppError RATE_LIMITED | VALIDATION_FAILED (wrong current / same new password) |
 *   CONFLICT (changed elsewhere meanwhile) | UNAUTHENTICATED (this session ended meanwhile) |
 *   FORBIDDEN (account locked meanwhile)
 */
export async function changePassword(input: {
  accountId: string;
  username: string;
  sessionId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  // Username key only: an unknown IP disables the per-IP key.
  const keys: LoginAttemptKeys = loginAttemptKeys(input.username, UNKNOWN_CLIENT_IP);
  const attemptIds = await recordLoginAttempt(keys);

  if (isLoginBlocked(await countRecentLoginAttempts(keys))) {
    await forgetLoginAttempt(attemptIds);
    throw new AppError("RATE_LIMITED");
  }

  const verifiedHash = await findPasswordHash(input.accountId);
  const currentMatches = verifiedHash
    ? await verifyPassword(verifiedHash, input.currentPassword)
    : false;
  if (!verifiedHash || !currentMatches) {
    // The recorded attempt stays: it is a failed password guess.
    throw new AppError("VALIDATION_FAILED", PASSWORD_CHANGE_MESSAGES.wrongCurrentPassword, {
      fieldErrors: { currentPassword: [PASSWORD_CHANGE_MESSAGES.wrongCurrentPassword] },
    });
  }

  // The right password is not a failed guess, whatever happens next.
  await forgetLoginAttempt(attemptIds);

  // The current password was just verified, so comparing the strings is exact.
  if (input.newPassword === input.currentPassword) {
    throw new AppError("VALIDATION_FAILED", PASSWORD_CHANGE_MESSAGES.samePassword, {
      fieldErrors: { newPassword: [PASSWORD_CHANGE_MESSAGES.samePassword] },
    });
  }

  const result = await changePasswordHash({
    accountId: input.accountId,
    verifiedHash,
    newHash: await hashPassword(input.newPassword),
    keepSessionId: input.sessionId,
  });

  switch (result) {
    case "changed":
      // Like a successful login: forgive this username's earlier failures.
      await clearUsernameFailures(keys);
      return;
    case "locked":
      throw new AppError("FORBIDDEN", LOGIN_MESSAGES.accountLocked);
    case "session-ended":
      throw new AppError("UNAUTHENTICATED");
    case "stale":
      throw new AppError("CONFLICT", PASSWORD_CHANGE_MESSAGES.changedElsewhere);
  }
}
