import { TRASH_RETENTION_DAYS } from "@/modules/patients/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days left before a trashed patient is deleted for good (spec "Tự xoá hẳn sau 30 ngày"):
 * 30 right after the move, 1 on the last day. Clamped to [1, 30]: `deleted_at` comes from the
 * database clock and `now` from the app server's, which may differ by a few seconds; an expired
 * patient is never listed (`trashIsLive()` decides that in SQL).
 */
export function daysLeft(deletedAt: Date | string, now: Date = new Date()): number {
  const elapsed = (now.getTime() - new Date(deletedAt).getTime()) / DAY_MS;
  return Math.min(TRASH_RETENTION_DAYS, Math.max(1, Math.ceil(TRASH_RETENTION_DAYS - elapsed)));
}
