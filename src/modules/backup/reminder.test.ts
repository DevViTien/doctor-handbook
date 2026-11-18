import { describe, expect, it } from "vitest";

import { describeLastBackup, reminderTitle, shouldRemind } from "@/modules/backup/reminder";
import type { BackupStatus } from "@/modules/backup/types";

const now = new Date("2026-11-19T03:00:00.000Z"); // 10:00 in Vietnam
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

function status(overrides: Partial<BackupStatus> = {}): BackupStatus {
  return {
    lastBackupAt: daysAgo(12),
    accountCreatedAt: daysAgo(60),
    lastChangeAt: daysAgo(3),
    counts: { patients: 4, trashed: 0, notes: 9, todos: 0, images: 0 },
    ...overrides,
  };
}

describe("shouldRemind", () => {
  it("Quá 7 ngày và có thay đổi", () => {
    expect(shouldRemind(status(), now)).toBe(true);
  });

  it("Quá 7 ngày nhưng không có thay đổi", () => {
    expect(shouldRemind(status({ lastChangeAt: daysAgo(13) }), now)).toBe(false);
  });

  it("Mới sao lưu", () => {
    expect(shouldRemind(status({ lastBackupAt: daysAgo(2), lastChangeAt: daysAgo(1) }), now)).toBe(
      false,
    );
  });

  it("exactly 7 days is not yet over 7 days", () => {
    expect(shouldRemind(status({ lastBackupAt: daysAgo(7) }), now)).toBe(false);
  });

  it("never backed up: counts from the account's creation", () => {
    expect(shouldRemind(status({ lastBackupAt: null, accountCreatedAt: daysAgo(3) }), now)).toBe(
      false,
    );
    expect(shouldRemind(status({ lastBackupAt: null, accountCreatedAt: daysAgo(8) }), now)).toBe(
      true,
    );
  });

  it("no data, no reminder", () => {
    const empty = { patients: 0, trashed: 0, notes: 0, todos: 0, images: 0 };
    expect(shouldRemind(status({ counts: empty, lastBackupAt: null }), now)).toBe(false);
  });
});

describe("describeLastBackup", () => {
  it("counts Vietnam calendar days", () => {
    expect(describeLastBackup(null, now)).toBe("Chưa sao lưu lần nào");
    expect(describeLastBackup(daysAgo(0.1), now)).toBe("hôm nay");
    expect(describeLastBackup(daysAgo(1), now)).toBe("hôm qua");
    expect(describeLastBackup(daysAgo(3), now)).toBe("3 ngày trước");
  });

  it("near midnight: 20 minutes earlier, but yesterday", () => {
    const justAfterMidnight = new Date("2026-11-18T17:10:00.000Z"); // 00:10 on the 19th
    expect(describeLastBackup("2026-11-18T16:50:00.000Z", justAfterMidnight)).toBe("hôm qua");
  });
});

describe("reminderTitle", () => {
  it("says how many days, or that there was never a backup", () => {
    expect(reminderTitle(status(), now)).toBe("Đã 12 ngày chưa sao lưu dữ liệu.");
    expect(reminderTitle(status({ lastBackupAt: null }), now)).toBe(
      "Bạn chưa sao lưu dữ liệu lần nào.",
    );
  });
});
