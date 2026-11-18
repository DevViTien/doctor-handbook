import "server-only";

import { AppError } from "@/lib/errors";

/**
 * Same-origin only, like Server Actions: a cross-site page cannot run a state-changing or
 * data-returning Route Handler with the doctor's cookie (`SameSite=Lax` already withholds it on
 * cross-site subrequests; this is the second lock). Browsers send `Origin` on every non-GET fetch.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host) throw new AppError("FORBIDDEN");
}

/**
 * For GET, where browsers do not always send `Origin`: refuse when the browser says the request
 * comes from another site. `Sec-Fetch-Site` is missing on old browsers; those are let through
 * (a cross-site page still cannot read the answer without CORS).
 */
export function assertNotCrossSite(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new AppError("FORBIDDEN");
}
