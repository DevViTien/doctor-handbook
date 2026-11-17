"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { routes } from "@/config/routes";
import { getSafeRedirectPath } from "@/lib/url";
import { loginSchema } from "@/modules/auth/schemas";
import { authenticate } from "@/modules/auth/server/login";
import { createFormAction } from "@/server/actions/create-action";
import { deleteSessionCookie, setSessionCookie } from "@/server/auth/cookies";
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

    const { token } = await createSession(account.id, {
      userAgent: requestHeaders.get("user-agent"),
    });
    await setSessionCookie(token);

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
