import { type NextRequest, NextResponse } from "next/server";

import { buildLoginPath, isApiPath, isPublicPath } from "@/config/routes";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import {
  getSessionCookieOptions,
  REQUEST_PATH_HEADER,
  SESSION_COOKIE_NAME,
} from "@/server/auth/constants";

/**
 * Optimistic auth gate (no database access here):
 * - no session cookie on a protected page -> redirect to login (keeping `next`);
 * - no session cookie on a protected API route -> 401 JSON (never an HTML redirect);
 * - otherwise re-set the cookie so its 400-day lifetime keeps sliding (idea.md D13) and
 *   forward the requested path to server code.
 *
 * The authoritative check is `requirePageAccess` / `requireAccess` on the server.
 * Never redirect *away* from public pages here: a stale cookie would cause a loop.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: DEFAULT_ERROR_MESSAGES.UNAUTHENTICATED } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL(buildLoginPath(`${pathname}${search}`), request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, `${pathname}${search}`);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and metadata files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|robots.txt).*)",
  ],
};
