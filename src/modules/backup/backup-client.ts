import { routes } from "@/config/routes";
import { DEFAULT_ERROR_MESSAGES } from "@/lib/errors";
import { gunzipJson, gzipJson, isImportableImage, packBackup } from "@/modules/backup/archive";
import {
  BACKUP_LIMITS,
  BACKUP_MESSAGES,
  IMPORT_TIMEOUT_MS,
  IMPORT_UPLOADS_PER_REQUEST,
  REPLACE_EXISTING_HEADER,
} from "@/modules/backup/constants";
import { backupFileName } from "@/modules/backup/format";
import { backupExportSchema, backupFileSchema } from "@/modules/backup/schemas";
import {
  discardImportUploadsAction,
  prepareImportUploadsAction,
  recordBackupAction,
} from "@/modules/backup/server/actions";
import type { BackupFile, BackupImage, ImportResult } from "@/modules/backup/types";

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
  options: {
    suffix?: string;
    offlineMessage?: string;
    /** Pictures fetched so far, for "Đang tải ảnh N/M…". */
    onProgress?: (done: number, total: number) => void;
  } = {},
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
  let sources: { patientId: string; ext: "webp" | "jpg"; url: string }[];
  try {
    const answer = backupExportSchema.parse(gunzipJson(bytes));
    file = backupFileSchema.parse({ manifest: answer.manifest, data: answer.data });
    sources = answer.images;
  } catch {
    throw new BackupError(DEFAULT_ERROR_MESSAGES.INTERNAL, false);
  }

  // Pictures come straight from storage (signed URLs), a few at a time; one missing picture
  // means no file: a backup is never silently incomplete.
  let done = 0;
  options.onProgress?.(0, sources.length);
  const fetched = await mapConcurrent(
    sources,
    BACKUP_LIMITS.imageConcurrency,
    async (source, _index, run) => {
      let bytes: Uint8Array;
      try {
        const response = await fetch(source.url, { cache: "no-store" });
        // Not served: reported like a lost connection (spec "Ảnh trong file sao lưu").
        if (!response.ok) throw offline;
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch {
        throw offline;
      }
      if (!run.stopped) {
        done += 1;
        options.onProgress?.(done, sources.length);
      }
      return { patientId: source.patientId, ext: source.ext, bytes } satisfies BackupImage;
    },
  );
  // Never put in a picture the import would refuse (too big, not an image): that one patient
  // keeps initials, the rest of the backup stays importable.
  const images = fetched.filter((image) => isImportableImage(image.bytes, image.ext));
  file.manifest.counts.images = images.length;

  const fileName = backupFileName(
    file.manifest.account.username,
    file.manifest.exportedAt,
    options.suffix,
  );
  // Never save a file that this app would refuse to import back.
  const zip = packBackup(file, images);
  const unpacked =
    new TextEncoder().encode(JSON.stringify(file)).byteLength +
    images.reduce((sum, image) => sum + image.bytes.byteLength, 0);
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
  /** Old patient id → path of its uploaded avatar (`uploadImportImages`). */
  images: Record<string, string> = {},
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
      body: gzipJson({ ...file, images }).slice().buffer,
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

/** Runs `task` over `items`, at most `limit` at a time, keeping the order of the results. */
async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number, run: { stopped: boolean }) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  // On the first failure: start nothing new, let what is in flight finish, then throw. Callers
  // check `run.stopped` before reporting progress, so a late success never hides the error.
  const run = { stopped: false };
  let failure: unknown;
  let next = 0;
  const worker = async () => {
    while (!run.stopped && next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await task(items[index] as T, index, run);
      } catch (error) {
        if (!run.stopped) failure = error;
        run.stopped = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (run.stopped) throw failure;
  return results;
}

/**
 * Uploads the avatars of a file being imported, straight to storage (design §5), before the
 * data is replaced. Returns old patient id → uploaded path. On any failure, removes what was
 * uploaded and throws: the import then does not run.
 */
export async function uploadImportImages(
  images: readonly BackupImage[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ paths: Record<string, string>; uploaded: string[] }> {
  if (images.length === 0) return { paths: {}, uploaded: [] };
  const failed = new BackupError(BACKUP_MESSAGES.imagesUploadFailed, true);
  const targets: { uploadUrl: string; path: string }[] = [];
  try {
    for (let start = 0; start < images.length; start += IMPORT_UPLOADS_PER_REQUEST) {
      const prepared = await prepareImportUploadsAction({
        formats: images.slice(start, start + IMPORT_UPLOADS_PER_REQUEST).map((image) => image.ext),
      });
      if (!prepared.ok) throw new BackupError(prepared.error.message, false);
      targets.push(...prepared.data.uploads);
    }
  } catch (error) {
    await discardImportUploads(targets.map((target) => target.path));
    if (error instanceof BackupError) throw error;
    throw failed;
  }
  const uploaded = targets.map((target) => target.path);

  let done = 0;
  onProgress?.(0, images.length);
  try {
    await mapConcurrent(images, BACKUP_LIMITS.imageConcurrency, async (image, index, run) => {
      const target = targets[index];
      if (!target) throw failed;
      const response = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": image.ext === "jpg" ? "image/jpeg" : "image/webp",
          "cache-control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: image.bytes.slice().buffer,
      });
      if (!response.ok) throw failed;
      if (!run.stopped) {
        done += 1;
        onProgress?.(done, images.length);
      }
    });
  } catch {
    await discardImportUploads(uploaded);
    throw failed;
  }
  const paths = Object.fromEntries(
    images.flatMap((image, index) => {
      const target = targets[index];
      return target ? [[image.patientId, target.path]] : [];
    }),
  );
  return { paths, uploaded };
}

/** Best effort: pictures uploaded for an import that did not happen. */
export async function discardImportUploads(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await discardImportUploadsAction({ paths: [...paths] });
  } catch {
    // Offline: the orphans are unreachable (random names, no row points at them).
  }
}
