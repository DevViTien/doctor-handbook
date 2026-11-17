import "server-only";

import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { routes } from "@/config/routes";
import type { AccountRole } from "@/lib/enums";
import { AppError } from "@/lib/errors";
import { getSafeRedirectPath } from "@/lib/url";

import { REQUEST_PATH_HEADER } from "./constants";
import { getSessionToken } from "./cookies";
import { type AuthContext, validateSessionToken } from "./session";

/** Who may access a page, action or route handler. */
export type AccessLevel = "authenticated" | AccountRole;

/**
 * Current auth context, memoized per request (layouts, pages and actions share one lookup).
 * This is the real authorization source; `src/proxy.ts` only does an optimistic redirect.
 */
export const getCurrentAuth = cache(async (): Promise<AuthContext | null> => {
  const token = await getSessionToken();
  return token ? validateSessionToken(token) : null;
});

export function getHomeRouteForRole(role: AccountRole): Route {
  return role === "admin" ? routes.admin.accessCodes : routes.doctor.patients;
}

function hasAccess(auth: AuthContext, level: AccessLevel): boolean {
  return level === "authenticated" || auth.account.role === level;
}

/**
 * For pages and layouts: redirects instead of rendering when access is denied.
 *
 * A missing or dead session goes through the clear-session route: Server Components cannot
 * delete cookies, and leaving a revoked cookie in place would make the proxy refresh it
 * forever. The requested path is preserved as `next`.
 */
export async function requirePageAccess(level: AccessLevel): Promise<AuthContext> {
  const auth = await getCurrentAuth();

  if (!auth) {
    const nextPath = getSafeRedirectPath((await headers()).get(REQUEST_PATH_HEADER));
    const query = nextPath ? `?${new URLSearchParams({ next: nextPath }).toString()}` : "";
    redirect(`${routes.api.clearSession}${query}`);
  }

  if (!hasAccess(auth, level)) redirect(getHomeRouteForRole(auth.account.role));
  return auth;
}

/** For login/activation pages: signed-in users go straight to their home screen. */
export async function redirectIfAuthenticated(): Promise<void> {
  const auth = await getCurrentAuth();
  if (auth) redirect(getHomeRouteForRole(auth.account.role));
}

/** For Server Actions, Route Handlers and the DAL: throws a typed error instead. */
export async function requireAccess(level: AccessLevel): Promise<AuthContext> {
  const auth = await getCurrentAuth();
  if (!auth) throw new AppError("UNAUTHENTICATED");
  if (!hasAccess(auth, level)) throw new AppError("FORBIDDEN");
  return auth;
}
