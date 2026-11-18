import { vietnamIsoDay } from "@/lib/date/calendar";
import { BACKUP_FORMAT_VERSION } from "@/modules/backup/constants";
import { backupFileSchema, backupHeaderSchema } from "@/modules/backup/schemas";
import type { BackupCounts, BackupFile } from "@/modules/backup/types";

/**
 * Reading any format version (design §2). `UPGRADERS[v]` turns the `{ manifest, data }` of
 * version `v` into version `v + 1`. Each one must
 * be kept forever: a file written today may be imported years from now.
 */
type RawBackup = { manifest: Record<string, unknown>; data: unknown };
const UPGRADERS: Partial<Record<number, (backup: RawBackup) => RawBackup>> = {
  // 1 → 2 (change add-patient-avatars): files may carry `images/`; v1 files have none.
  1: (backup) => ({
    ...backup,
    manifest: {
      ...backup.manifest,
      counts: { ...(backup.manifest.counts as Record<string, unknown>), images: 0 },
    },
  }),
};

export type ReadBackupResult =
  { ok: true; file: BackupFile } | { ok: false; reason: "broken" | "newer" };

/** Checks and upgrades the two parsed JSON files of a backup. Never throws. */
export function readBackup(manifest: unknown, data: unknown): ReadBackupResult {
  const header = backupHeaderSchema.safeParse(manifest);
  if (!header.success) return { ok: false, reason: "broken" };
  if (header.data.formatVersion > BACKUP_FORMAT_VERSION) return { ok: false, reason: "newer" };

  let backup: RawBackup = { manifest: manifest as Record<string, unknown>, data };
  for (let version = header.data.formatVersion; version < BACKUP_FORMAT_VERSION; version += 1) {
    const upgrade = UPGRADERS[version];
    if (!upgrade) return { ok: false, reason: "broken" };
    backup = upgrade(backup);
  }

  const parsed = backupFileSchema.safeParse({
    manifest: { ...backup.manifest, formatVersion: BACKUP_FORMAT_VERSION },
    data: backup.data,
  });
  return parsed.success ? { ok: true, file: parsed.data } : { ok: false, reason: "broken" };
}

/** `doctor-handbook_bs.lan_2026-11-19.zip` (Vietnam calendar day). No patient data in it. */
export function backupFileName(username: string, exportedAt: string, suffix = ""): string {
  return `doctor-handbook_${username}_${vietnamIsoDay(exportedAt)}${suffix}.zip`;
}

/** "132 bệnh nhân, 845 ghi chú, 20 việc". */
export function describeCounts(counts: BackupCounts): string {
  return `${counts.patients} bệnh nhân, ${counts.notes} ghi chú, ${counts.todos} việc`;
}
