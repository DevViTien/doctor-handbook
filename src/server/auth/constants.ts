/**
 * Auth constants. Deliberately free of `server-only` and Node APIs so that `src/proxy.ts`
 * can import them too.
 */

export const SESSION_COOKIE_NAME = "dh_session";

/**
 * Browsers cap cookie lifetime at 400 days. The proxy re-sets the cookie on every visit, so
 * an active doctor stays signed in indefinitely (idea.md D13).
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Throttles `sessions.last_used_at` writes to at most one per day per session. */
export const SESSION_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Activation and password-reset codes expire after 72 hours (idea.md D17). */
export const ACCESS_CODE_TTL_MS = 72 * 60 * 60 * 1000;
export const ACCESS_CODE_LENGTH = 8;
/** Uppercase letters and digits without look-alikes (0/O, 1/I/L). */
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Failed attempts older than this are irrelevant for rate limiting and get pruned daily. */
export const AUTH_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Login rate limiting (spec account-session). Failed logins are counted in a sliding window;
 * at the threshold every further attempt is refused, even with the right password, until older
 * failures slide out of the window. The window must fit within AUTH_ATTEMPT_RETENTION_MS.
 */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES_PER_USERNAME = 5;
/** Higher than per-username: a whole clinic may share one public IP. */
export const LOGIN_MAX_FAILURES_PER_IP = 20;

/**
 * Request header set by `src/proxy.ts` with the requested path + query, so server code
 * (which has no pathname API in layouts) can send users back there after login.
 */
export const REQUEST_PATH_HEADER = "x-dh-request-path";

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
