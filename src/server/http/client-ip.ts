import "server-only";

/** Bucket used when no address can be read (local development, unusual proxies). */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Best-effort client IP for rate limiting. On Vercel, `x-real-ip` and `x-forwarded-for` are set
 * by the platform (client-supplied values are overwritten), so they can be trusted there.
 * Never use the result for authorization decisions.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;

  return UNKNOWN_CLIENT_IP;
}
