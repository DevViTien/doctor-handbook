import { calendarDaysBetween } from "@/lib/date/calendar";
import { BACKUP_MESSAGES, BACKUP_REMINDER_DAYS } from "@/modules/backup/constants";
import type { BackupStatus } from "@/modules/backup/types";

/** When to show the backup reminder and what it says (spec data-backup, design §5). Pure. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function hasData(status: BackupStatus): boolean {
  const { patients, notes, todos } = status.counts;
  return patients + notes + todos > 0;
}

/**
 * Data exists, the last backup (or the account's creation) is more than 7 days old, and data
 * changed since that backup. Never backed up counts as changed.
 */
export function shouldRemind(status: BackupStatus, now: Date): boolean {
  if (!hasData(status)) return false;
  const since = status.lastBackupAt ?? status.accountCreatedAt;
  if (now.getTime() - Date.parse(since) <= BACKUP_REMINDER_DAYS * DAY_MS) return false;
  if (status.lastBackupAt === null) return true;
  return (
    status.lastChangeAt !== null &&
    Date.parse(status.lastChangeAt) > Date.parse(status.lastBackupAt)
  );
}

/** "hôm nay", "hôm qua", "3 ngày trước", or "Chưa sao lưu lần nào". */
export function describeLastBackup(lastBackupAt: string | null, now: Date): string {
  if (lastBackupAt === null) return BACKUP_MESSAGES.neverBackedUp;
  const days = Math.max(0, calendarDaysBetween(lastBackupAt, now));
  if (days === 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  return `${days} ngày trước`;
}

/** The reminder's headline. */
export function reminderTitle(status: BackupStatus, now: Date): string {
  if (status.lastBackupAt === null) return "Bạn chưa sao lưu dữ liệu lần nào.";
  return `Đã ${calendarDaysBetween(status.lastBackupAt, now)} ngày chưa sao lưu dữ liệu.`;
}
