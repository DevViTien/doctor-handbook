import { describe, expect, it } from "vitest";

import { BACKUP_FORMAT_VERSION } from "@/modules/backup/constants";
import { backupFileName, describeCounts, readBackup } from "@/modules/backup/format";
import { backupFileSchema } from "@/modules/backup/schemas";
import { PATIENT_AN, sampleBackup } from "@/modules/backup/test-fixtures";

const read = (backup = sampleBackup()) => readBackup(backup.manifest, backup.data);

describe("backupFileSchema / readBackup", () => {
  it("accepts a valid file and drops unknown keys", () => {
    const backup = sampleBackup();
    Object.assign(backup.data.patients[0]!, { accountId: "someone-else", searchText: "x" });

    const result = read(backup);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.data.patients[0]).not.toHaveProperty("accountId");
    expect(result.file.data.patients[0]).not.toHaveProperty("searchText");
    expect(result.file.data.patients[1]?.deletedAt).toBe("2026-11-05T02:00:00.000Z");
  });

  it.each([
    [
      "a patient without a name",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[0]!.fullName = "   ";
      },
    ],
    [
      "a name over the limit",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[0]!.fullName = "A".repeat(101);
      },
    ],
    [
      "a note over the limit",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.notes[0]!.content = "x".repeat(5001);
      },
    ],
    [
      "a phone with letters",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[0]!.phone = "09abc";
      },
    ],
    [
      "a birth date in another year than the birth year",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[0]!.birthYear = 1980;
      },
    ],
    [
      "a date that does not exist",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[0]!.birthDate = "1979-02-31";
      },
    ],
    [
      "a note whose patient is not in the file",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.notes[0]!.patientId = "9b5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a09";
      },
    ],
    [
      "a duplicate patient id",
      (b: ReturnType<typeof sampleBackup>) => {
        b.data.patients[1]!.id = PATIENT_AN;
      },
    ],
    [
      "counts that do not match",
      (b: ReturnType<typeof sampleBackup>) => {
        b.manifest.counts.notes = 4;
      },
    ],
    [
      "another app's manifest",
      (b: ReturnType<typeof sampleBackup>) => {
        (b.manifest as { app: string }).app = "other-app";
      },
    ],
  ])("refuses %s as broken", (_label, tamper) => {
    const backup = sampleBackup();
    tamper(backup);
    expect(read(backup)).toEqual({ ok: false, reason: "broken" });
  });

  it("refuses a newer format version with its own reason", () => {
    const backup = sampleBackup();
    (backup.manifest as { formatVersion: number }).formatVersion = BACKUP_FORMAT_VERSION + 1;
    expect(read(backup)).toEqual({ ok: false, reason: "newer" });
  });

  it("only accepts the current version on the server schema", () => {
    const backup = sampleBackup();
    (backup.manifest as { formatVersion: number }).formatVersion = 0;
    expect(backupFileSchema.safeParse(backup).success).toBe(false);
  });

  it("normalizes text like the forms (NFC, trimmed, empty as null)", () => {
    const backup = sampleBackup();
    backup.data.patients[0]!.fullName = "  Nguyễn Văn An ";
    backup.data.patients[0]!.hometown = "  ";
    const result = read(backup);
    expect(result.ok && result.file.data.patients[0]).toMatchObject({
      fullName: "Nguyễn Văn An",
      hometown: null,
    });
  });
});

describe("backupFileName", () => {
  it("uses the Vietnam calendar day", () => {
    // 18:00 UTC on the 18th is already the 19th in Vietnam.
    expect(backupFileName("bs.lan", "2026-11-18T18:00:00.000Z")).toBe(
      "doctor-handbook_bs.lan_2026-11-19.zip",
    );
  });

  it("adds the pre-import suffix", () => {
    expect(backupFileName("bs.lan", "2026-11-19T03:00:00.000Z", "_truoc-khi-nhap")).toBe(
      "doctor-handbook_bs.lan_2026-11-19_truoc-khi-nhap.zip",
    );
  });
});

describe("describeCounts", () => {
  it("reads like the summary", () => {
    expect(describeCounts({ patients: 132, notes: 845, todos: 20 })).toBe(
      "132 bệnh nhân, 845 ghi chú, 20 việc",
    );
  });
});
