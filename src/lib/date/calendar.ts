import { siteConfig } from "@/config/site";

/** Calendar-day helpers in Vietnam time, whatever the device's or server's time zone. */

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DateInput = Date | string | number;

/** "2026-11-19": the Vietnam calendar day of an instant. */
export function vietnamIsoDay(value: DateInput): string {
  const parts = Object.fromEntries(
    isoDayFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole Vietnam calendar days from `from` to `to`: 0 the same day, 1 the next day (even 1 min later). */
export function calendarDaysBetween(from: DateInput, to: DateInput): number {
  const day = (value: DateInput) => Date.parse(`${vietnamIsoDay(value)}T00:00:00Z`);
  return Math.round((day(to) - day(from)) / DAY_MS);
}
