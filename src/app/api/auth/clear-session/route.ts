import { type NextRequest, NextResponse } from "next/server";

import { buildLoginPath } from "@/config/routes";
import { getSafeRedirectPath } from "@/lib/url";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { getCurrentAuth, getHomeRouteForRole } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

/**
 * Target of `requirePageAccess` when the session cookie is missing or dead (logged out
 * elsewhere, password reset, account locked). Deletes the cookie and redirects to login.
 *
 * A *valid* session is never cleared here, so a cross-site GET cannot log anyone out.
 */
export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();
  if (auth) {
    return NextResponse.redirect(new URL(getHomeRouteForRole(auth.account.role), request.url));
  }

  const nextPath = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(buildLoginPath(nextPath), request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
