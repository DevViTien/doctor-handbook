/**
 * Short device label for the admin, e.g. "iPhone · Safari" (spec feedback). A rough guess from
 * the `User-Agent` header, only for context: no library for a single label. iPadOS reports
 * itself as a Mac, so an iPad shows as "Mac".
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  return `${deviceOf(ua)} · ${browserOf(ua)}`;
}

function deviceOf(ua: string): string {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/Linux|CrOS/.test(ua)) return "Linux";
  return "Máy khác";
}

function browserOf(ua: string): string {
  // Order matters: every Chromium browser also says "Chrome" and "Safari".
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Edg/.test(ua)) return "Edge";
  if (/FxiOS|Firefox/.test(ua)) return "Firefox";
  if (/CriOS|Chrome/.test(ua)) return "Chrome";
  if (/Safari/.test(ua)) return "Safari";
  return "Trình duyệt khác";
}
