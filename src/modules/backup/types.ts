import type { z } from "zod";

import type { backupFileSchema } from "@/modules/backup/schemas";

/** A checked backup of the current format version (what is zipped, and what is imported). */
export type BackupFile = z.output<typeof backupFileSchema>;
/** The same, before normalization: what the server builds from the database. */
export type BackupFileInput = z.input<typeof backupFileSchema>;

export type BackupCounts = { patients: number; notes: number; todos: number };

/** One avatar in a backup: `images/<patientId>.<ext>` (format 2). */
export type BackupImage = { patientId: string; ext: "webp" | "jpg"; bytes: Uint8Array };

/** What the backup page, Settings and the reminder need (design §5). ISO strings. */
export type BackupStatus = {
  lastBackupAt: string | null;
  accountCreatedAt: string;
  /** Latest add, edit, move to trash or restore; `null` when there is no data. */
  lastChangeAt: string | null;
  /** Patients include the ones still restorable from the trash (`trashed` of them). */
  counts: BackupCounts & { trashed: number; images: number };
};

/** What an import wrote. */
export type ImportResult = BackupCounts & { images: number };
