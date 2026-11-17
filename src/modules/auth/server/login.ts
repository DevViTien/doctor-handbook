import "server-only";

import { randomBytes } from "node:crypto";

import type { AccountRole } from "@/lib/enums";
import { AppError } from "@/lib/errors";
import { LOGIN_MESSAGES } from "@/modules/auth/constants";
import { recordLoginSuccess } from "@/modules/auth/server/mutations";
import { findAccountForLogin } from "@/modules/auth/server/queries";
import {
  clearUsernameFailures,
  countRecentLoginAttempts,
  forgetLoginAttempt,
  isLoginBlocked,
  loginAttemptKeys,
  recordLoginAttempt,
} from "@/modules/auth/server/rate-limit";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export type AuthenticatedAccount = { id: string; role: AccountRole };

/**
 * A real Argon2id hash of a random secret, verified when the username does not exist so that
 * "unknown user" takes as long as "wrong password" (no username enumeration by timing).
 * Computed when the module loads, so the first request after a cold start is not slower; a
 * failed computation is retried instead of being cached.
 */
let dummyHashPromise: Promise<string> | undefined = computeDummyHash();

function computeDummyHash(): Promise<string> {
  const promise = hashPassword(randomBytes(16).toString("hex"));
  promise.catch(() => {
    if (dummyHashPromise === promise) dummyHashPromise = undefined;
  });
  return promise;
}

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= computeDummyHash();
  return dummyHashPromise;
}

/**
 * Checks a login attempt (design §3, §4). Knows nothing about cookies or redirects.
 *
 * 1. Record the attempt, then count (record-then-count: parallel attempts cannot slip past the
 *    limit). Blocked → forget it (a refused attempt is not a failure) and refuse, even with the
 *    right password.
 * 2. Always verify a hash (the dummy one for unknown users).
 * 3. Wrong credentials → the recorded attempt stays as a failure.
 * 4. A locked account is only revealed when the password is correct (not a failure).
 *
 * @throws AppError RATE_LIMITED | UNAUTHENTICATED (wrong credentials) | FORBIDDEN (locked)
 */
export async function authenticate(input: {
  username: string;
  password: string;
  ip: string;
}): Promise<AuthenticatedAccount> {
  const keys = loginAttemptKeys(input.username, input.ip);
  const attemptIds = await recordLoginAttempt(keys);

  if (isLoginBlocked(await countRecentLoginAttempts(keys))) {
    await forgetLoginAttempt(attemptIds);
    throw new AppError("RATE_LIMITED");
  }

  const account = await findAccountForLogin(input.username);
  const passwordHash = account?.passwordHash ?? (await getDummyHash());
  const passwordMatches = await verifyPassword(passwordHash, input.password);

  if (!account || !passwordMatches) {
    throw new AppError("UNAUTHENTICATED", LOGIN_MESSAGES.invalidCredentials);
  }

  if (account.status !== "active") {
    await forgetLoginAttempt(attemptIds);
    throw new AppError("FORBIDDEN", LOGIN_MESSAGES.accountLocked);
  }

  await Promise.all([
    forgetLoginAttempt(attemptIds),
    clearUsernameFailures(keys),
    recordLoginSuccess(account.id),
  ]);
  return { id: account.id, role: account.role };
}
