"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors";
import { getSafeRedirectPath } from "@/lib/url";
import { LOGIN_MESSAGES } from "@/modules/auth/constants";
import {
  activateAccountSchema,
  activationCodeSchema,
  loginSchema,
  passwordResetCodeSchema,
  resetPasswordSchema,
} from "@/modules/auth/schemas";
import { activateAccount, checkActivationCode } from "@/modules/auth/server/activation";
import { authenticate } from "@/modules/auth/server/login";
import { checkPasswordResetCode, resetPassword } from "@/modules/auth/server/password-reset";
import { createFormAction } from "@/server/actions/create-action";
import { deleteSessionCookie, setSessionCookie } from "@/server/auth/cookies";
import { normalizeAccessCode } from "@/server/auth/crypto";
import { getHomeRouteForRole } from "@/server/auth/guards";
import { createSession, invalidateSession } from "@/server/auth/session";
import { getClientIp } from "@/server/http/client-ip";

/**
 * Login form action (spec account-session). On success it never returns: it sets the session
 * cookie and redirects. Usernames and passwords are never logged (createAction only logs the
 * action name and unexpected errors).
 */
export const loginFormAction = createFormAction(
  { name: "auth.login", schema: loginSchema, access: "public" },
  async (input, { auth: previous }): Promise<never> => {
    const requestHeaders = await headers();
    const account = await authenticate({
      username: input.username,
      password: input.password,
      ip: getClientIp(requestHeaders),
    });

    // Submitting the form while already signed in (another tab) replaces that session: the old
    // row would otherwise be orphaned forever, since sessions never expire.
    if (previous) await invalidateSession(previous.sessionId);

    const session = await createSession(account.id, {
      userAgent: requestHeaders.get("user-agent"),
    });
    // Locked between the password check and here (an admin lock racing this login).
    if (!session) throw new AppError("FORBIDDEN", LOGIN_MESSAGES.accountLocked);
    await setSessionCookie(session.token);

    redirect(getSafeRedirectPath(input.next) ?? getHomeRouteForRole(account.role));
  },
);

/**
 * Ends the session of this device only; other devices stay signed in. No confirmation (N2).
 * Idempotent on purpose ("public"): if the session is already gone (logged out in another tab,
 * revoked), the cookie is still cleared instead of leaving the user stuck. Server Actions are
 * protected against cross-site posts by Next.js' Origin check.
 */
export const logoutAction = createFormAction(
  { name: "auth.logout", schema: z.object({}), access: "public" },
  async (_input, { auth }): Promise<never> => {
    if (auth) await invalidateSession(auth.sessionId);
    await deleteSessionCookie();
    redirect(routes.auth.login);
  },
);

/** Step 1 result: who the code was issued for. The code comes back normalized for step 2. */
export type CheckedActivationCode = {
  code: string;
  recipientName: string;
  /** ISO timestamp. */
  expiresAt: string;
};

/**
 * Activation step 1 (spec account-activation): checks the code, rate limited per IP. The code
 * only travels in POST bodies, never in a URL. Codes, usernames and passwords are never logged.
 */
export const checkActivationCodeFormAction = createFormAction(
  { name: "auth.checkActivationCode", schema: activationCodeSchema, access: "public" },
  async (input): Promise<CheckedActivationCode> => {
    const info = await checkActivationCode({
      code: input.code,
      ip: getClientIp(await headers()),
    });
    return {
      code: normalizeAccessCode(input.code),
      recipientName: info.recipientName,
      expiresAt: info.expiresAt.toISOString(),
    };
  },
);

/**
 * Activation step 2: re-checks the code, creates the doctor account and its first session in
 * one transaction, then signs the doctor in on this device and opens the patient list.
 */
export const activateAccountFormAction = createFormAction(
  { name: "auth.activateAccount", schema: activateAccountSchema, access: "public" },
  async (input, { auth: previous }): Promise<never> => {
    const requestHeaders = await headers();
    const { sessionToken } = await activateAccount({
      code: input.code,
      displayName: input.displayName,
      username: input.username,
      password: input.password,
      ip: getClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
    });

    // Same as login: a session this browser still had would otherwise be orphaned forever.
    if (previous) await invalidateSession(previous.sessionId);
    await setSessionCookie(sessionToken);
    redirect(routes.doctor.patients);
  },
);

/** Password reset step 1 result: the account the code is for. Code returned normalized. */
export type CheckedPasswordResetCode = {
  code: string;
  username: string;
  /** ISO timestamp. */
  expiresAt: string;
};

/**
 * Password reset step 1 (spec password-reset): checks the code, rate limited per IP together
 * with activation codes. Codes and passwords are never logged and never put in a URL.
 */
export const checkPasswordResetCodeFormAction = createFormAction(
  { name: "auth.checkPasswordResetCode", schema: passwordResetCodeSchema, access: "public" },
  async (input): Promise<CheckedPasswordResetCode> => {
    const info = await checkPasswordResetCode({
      code: input.code,
      ip: getClientIp(await headers()),
    });
    return {
      code: normalizeAccessCode(input.code),
      username: info.username,
      expiresAt: info.expiresAt.toISOString(),
    };
  },
);

/**
 * Password reset step 2: sets the new password, ends every session of the account (§8.3),
 * signs this device in and opens the patient list.
 */
export const resetPasswordFormAction = createFormAction(
  { name: "auth.resetPassword", schema: resetPasswordSchema, access: "public" },
  async (input, { auth: previous }): Promise<never> => {
    const requestHeaders = await headers();
    const { sessionToken } = await resetPassword({
      code: input.code,
      password: input.password,
      ip: getClientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
    });

    // A session of another account in this browser would otherwise be orphaned.
    if (previous) await invalidateSession(previous.sessionId);
    await setSessionCookie(sessionToken);
    redirect(routes.doctor.patients);
  },
);
