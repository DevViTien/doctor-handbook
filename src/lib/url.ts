/**
 * Returns `value` only if it is a same-origin relative path ("/patients?q=an"), otherwise
 * `null`. Use it for every `?next=` redirect target to prevent open redirects:
 * "//evil.com", "/\\evil.com", "https://evil.com" and "javascript:..." are all rejected.
 */
export function getSafeRedirectPath(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  // Control characters (including tab/newline) can be stripped by URL parsers into "//".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/** Whether `href` is the current section: exact match or a sub-path ("/patients/123"). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
