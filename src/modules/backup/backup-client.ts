import { routes } from "@/config/routes";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import { gunzipJson, gzipJson, packBackup } from "@/modules/backup/archive";
import {
  BACKUP_LIMITS,
  BACKUP_MESSAGES,
  IMPORT_TIMEOUT_MS,
  REPLACE_EXISTING_HEADER,
} from "@/modules/backup/constants";
import { backupFileName } from "@/modules/backup/format";
import { backupFileSchema } from "@/modules/backup/schemas";
import { recordBackupAction } from "@/modules/backup/server/actions";
import type { BackupFile, ImportResult } from "@/modules/backup/types";

/**
 * Browser side of backup and import (design §3–§4). Errors are `BackupError`s whose message is
 * ready to show; `offline` tells a lost connection from a refusal.
 */
export class BackupError extends Error {
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message);
    this.name = "BackupError";
  }
}

async function errorMessageOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message =
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object"
      ? (body.error as { message?: unknown }).message
      : undefined;
  return typeof message === "string" ? message : DEFAULT_ERROR_MESSAGES.INTERNAL;
}

function saveFile(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers read the blob after `click()` returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The account got data since the page was loaded: reload, confirm and back it up first. */
export class BackupConflictError extends BackupError {
  constructor(message: string) {
    super(message, false);
    this.name = "BackupConflictError";
  }
}

export type DownloadResult = { fileName: string; recorded: boolean };

/**
 * Fetches the account's data, zips it, saves the file, then records the backup. A file the app
 * could not import back is never saved: the server's answer is checked with the import schema.
 */
export async function downloadBackup(
  options: { suffix?: string; offlineMessage?: string } = {},
): Promise<DownloadResult> {
  const offline = new BackupError(options.offlineMessage ?? BACKUP_MESSAGES.exportOffline, true);
  let bytes: Uint8Array;
  try {
    const response = await fetch(routes.api.backup, { cache: "no-store" });
    if (!response.ok) throw new BackupError(await errorMessageOf(response), false);
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw offline;
  }

  let file: BackupFile;
  try {
    file = backupFileSchema.parse(gunzipJson(bytes));
  } catch {
    throw new BackupError(DEFAULT_ERROR_MESSAGES.INTERNAL, false);
  }

  const fileName = backupFileName(
    file.manifest.account.username,
    file.manifest.exportedAt,
    options.suffix,
  );
  // Never save a file that this app would refuse to import back.
  const zip = packBackup(file);
  const unpacked = new TextEncoder().encode(JSON.stringify(file)).byteLength;
  if (zip.byteLength > BACKUP_LIMITS.fileBytes || unpacked > BACKUP_LIMITS.unpackedBytes) {
    throw new BackupError(BACKUP_MESSAGES.exportTooLarge, false);
  }
  saveFile(zip, fileName);

  // The file is on the device already; failing to record only delays the date shown.
  let recorded = false;
  try {
    recorded = (await recordBackupAction({})).ok;
  } catch {
    recorded = false;
  }
  return { fileName, recorded };
}

/**
 * Sends a checked (and upgraded) backup for the replace-all import. `replacingExisting`: the
 * doctor saw the account's data, confirmed, and a backup of it was saved.
 */
export async function sendImport(
  file: BackupFile,
  replacingExisting: boolean,
): Promise<ImportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);
  try {
    const response = await fetch(routes.api.backup, {
      method: "PUT",
      headers: {
        "Content-Type": "application/gzip",
        ...(replacingExisting ? { [REPLACE_EXISTING_HEADER]: "1" } : {}),
      },
      body: gzipJson(file).slice().buffer,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await errorMessageOf(response);
      if (response.status === 409) throw new BackupConflictError(message);
      // A server error after the rollback: the data did not change.
      throw new BackupError(response.status >= 500 ? BACKUP_MESSAGES.importFailed : message, false);
    }
    return (await response.json()) as ImportResult;
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError(BACKUP_MESSAGES.importOffline, true);
  } finally {
    clearTimeout(timer);
  }
}
