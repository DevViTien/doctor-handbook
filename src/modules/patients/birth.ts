import { siteConfig } from "@/config/site";
import { PATIENT_LIMITS, PATIENT_MESSAGES } from "@/modules/patients/constants";
import type { Birth } from "@/modules/patients/types";

/**
 * The "Năm sinh hoặc tuổi" field (spec patient-records, design §3). Pure and client-safe: the
 * form uses it to show how the input was understood, and the server schema parses with it again.
 */

export type CalendarDay = { year: number; month: number; day: number };

export type BirthParse =
  | { kind: "empty" }
  | { kind: "ok"; birthYear: number; birthDate: string | null }
  | { kind: "error"; message: string };

const todayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Today's calendar date in Vietnam, whatever the device's or server's time zone. */
export function todayInVietnam(now: Date = new Date()): CalendarDay {
  const parts = Object.fromEntries(
    todayFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

const YEAR_PATTERN = /^\d{4}$/;
const AGE_PATTERN = /^(\d{1,3})\s*(t|tuổi|tuoi)?$/iu;
const DATE_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

const pad = (value: number) => String(value).padStart(2, "0");

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isAfter(a: CalendarDay, b: CalendarDay): boolean {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day > b.day;
}

/**
 * Reads `1979` (year), `45t` / `45 tuổi` / `45` (age) or `12/03/1979` (full date; `-` and `.`
 * also accepted). An age becomes `today.year - age`. Four digits are always a year.
 */
export function parseBirthInput(text: string, today: CalendarDay): BirthParse {
  const input = text.normalize("NFC").trim();
  if (!input) return { kind: "empty" };

  if (YEAR_PATTERN.test(input)) {
    const year = Number(input);
    if (year < PATIENT_LIMITS.minBirthYear || year > today.year) {
      return { kind: "error", message: PATIENT_MESSAGES.birthYearOutOfRange };
    }
    return { kind: "ok", birthYear: year, birthDate: null };
  }

  const age = AGE_PATTERN.exec(input);
  if (age) {
    const years = Number(age[1]);
    if (years > PATIENT_LIMITS.maxAge)
      return { kind: "error", message: PATIENT_MESSAGES.ageOutOfRange };
    return { kind: "ok", birthYear: today.year - years, birthDate: null };
  }

  const date = DATE_PATTERN.exec(input);
  if (date) {
    const day = Number(date[1]);
    const month = Number(date[2]);
    const year = Number(date[3]);
    if (year < PATIENT_LIMITS.minBirthYear) {
      return { kind: "error", message: PATIENT_MESSAGES.birthYearOutOfRange };
    }
    const exists = month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
    if (!exists || isAfter({ year, month, day }, today)) {
      return { kind: "error", message: PATIENT_MESSAGES.birthDateInvalid };
    }
    return { kind: "ok", birthYear: year, birthDate: `${year}-${pad(month)}-${pad(day)}` };
  }

  return { kind: "error", message: PATIENT_MESSAGES.birthUnreadable };
}

/** `"1979-03-12"` → `"12/03/1979"`. */
export function formatBirthDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** The stored value as the edit form shows it: `1979` or `12/03/1979` (empty when unknown). */
export function formatBirthInput(birth: Birth): string {
  if (birth.birthDate) return formatBirthDate(birth.birthDate);
  return birth.birthYear === null ? "" : String(birth.birthYear);
}

/**
 * Age in Vietnam today: completed years when the full date is known, otherwise
 * `today.year - birthYear`. `null` when nothing is known.
 */
export function ageOf(birth: Birth, today: CalendarDay): number | null {
  if (birth.birthDate) {
    const [year, month, day] = birth.birthDate.split("-").map(Number) as [number, number, number];
    const hadBirthday = !isAfter({ year: today.year, month, day }, today);
    return Math.max(0, today.year - year - (hadBirthday ? 0 : 1));
  }
  if (birth.birthYear === null) return null;
  return Math.max(0, today.year - birth.birthYear);
}

/** `"45 tuổi"`, or `"Dưới 1 tuổi"` for a baby. */
export function describeAge(age: number): string {
  return age === 0 ? "Dưới 1 tuổi" : `${age} tuổi`;
}

/** Age for the list rows, or `null` when unknown. */
export function describeListAge(birth: Birth, today: CalendarDay): string | null {
  const age = ageOf(birth, today);
  return age === null ? null : describeAge(age);
}

/** Detail page: `"47 tuổi (1979)"` or `"47 tuổi (12/03/1979)"`. */
export function describeBirthDetail(birth: Birth, today: CalendarDay): string | null {
  const age = ageOf(birth, today);
  if (age === null) return null;
  return `${describeAge(age)} (${formatBirthInput(birth)})`;
}

/** The line under the field: `"Năm sinh 1981 · 45 tuổi"` or `"Ngày sinh 12/03/1979 · 47 tuổi"`. */
export function describeBirthReading(birth: Birth, today: CalendarDay): string | null {
  const age = ageOf(birth, today);
  if (age === null) return null;
  const label = birth.birthDate
    ? `Ngày sinh ${formatBirthDate(birth.birthDate)}`
    : `Năm sinh ${birth.birthYear}`;
  return `${label} · ${describeAge(age)}`;
}
