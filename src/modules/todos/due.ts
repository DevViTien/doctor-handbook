import type { TodoItem } from "@/modules/todos/types";

/**
 * Due dates and order of the list (spec todo-list "Ngày hạn và thứ tự"). Pure: `today` is the
 * Vietnam calendar day ("yyyy-mm-dd") from `vietnamIsoDay`.
 */

export type DueTone = "overdue" | "today" | "soon" | "plain";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDay: string) => Date.parse(`${isoDay}T00:00:00Z`) / DAY_MS;

/** "16/11", or "16/11/2027" when not this year. */
export function shortDay(isoDay: string, today: string): string {
  const day = `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}`;
  return isoDay.slice(0, 4) === today.slice(0, 4) ? day : `${day}/${isoDay.slice(0, 4)}`;
}

export function describeDue(dueDate: string, today: string): { text: string; tone: DueTone } {
  const days = Math.round(dayNumber(dueDate) - dayNumber(today));
  if (days < 0) return { text: `Quá hạn · ${shortDay(dueDate, today)}`, tone: "overdue" };
  if (days === 0) return { text: "Hôm nay", tone: "today" };
  if (days === 1) return { text: "Ngày mai", tone: "soon" };
  return { text: shortDay(dueDate, today), tone: "plain" };
}

const newestFirst = (a: TodoItem, b: TodoItem) =>
  b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/** Dated first (earliest due on top, then newest), then undated (newest on top). */
export function compareOpen(a: TodoItem, b: TodoItem): number {
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || newestFirst(a, b);
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return newestFirst(a, b);
}

/** Most recently completed on top. */
export function compareDone(a: TodoItem, b: TodoItem): number {
  return (b.completedAt ?? "").localeCompare(a.completedAt ?? "") || newestFirst(a, b);
}
