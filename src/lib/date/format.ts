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

/** "18/11/2026, 09:05" (separator depends on the ICU data of the runtime). */
export function formatDateTime(value: DateInput): string {
  return dateTimeFormatter.format(toDate(value));
}

/** "3 ngày trước" */
export function formatRelative(value: DateInput): string {
  return formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: vi });
}
