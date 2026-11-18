import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";

import { siteConfig } from "@/config/site";

/**
 * Date display helpers. The database stores UTC (`timestamptz`); everything shown to users
 * is rendered in Vietnam time, regardless of the server's or the device's time zone.
 */

const dateFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type DateInput = Date | string | number;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

/** "18/11/2026" */
export function formatDate(value: DateInput): string {
  return dateFormatter.format(toDate(value));
}

/**
 * "18/11/2026 09:05": date first, 24-hour clock. Assembled from parts because the order and
 * separator of the `vi-VN` locale differ between ICU versions (Node may give "09:05 18/11/2026"),
 * and server and browser must render the same text.
 */
export function formatDateTime(value: DateInput): string {
  const parts = Object.fromEntries(
    dateTimeFormatter.formatToParts(toDate(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** "3 ngày trước" */
export function formatRelative(value: DateInput): string {
  return formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: vi });
}
