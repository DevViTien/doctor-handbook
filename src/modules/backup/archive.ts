import {
  gunzipSync,
  gzipSync,
  strFromU8,
  strToU8,
  unzipSync,
  type Zippable,
  zipSync,
} from "fflate";

import { BACKUP_LIMITS } from "@/modules/backup/constants";
import { readBackup } from "@/modules/backup/format";
import { BACKUP_IMAGE_NAME } from "@/modules/backup/schemas";
import type { BackupFile, BackupImage } from "@/modules/backup/types";

/**
 * The `.zip` itself, built and opened in the browser only (design §3–§4): it never goes to the
 * server. Plain JSON inside, so a doctor (or a future tool) can read it without this app; the
 * avatars sit next to it in `images/<patient id>.webp|jpg` (format 2).
 */

const MANIFEST = "manifest.json";
const DATA = "data.json";

export function packBackup(file: BackupFile, images: readonly BackupImage[] = []): Uint8Array {
  const entries: Zippable = {
    [MANIFEST]: strToU8(JSON.stringify(file.manifest, null, 2)),
    // Compact: the same size budget as the JSON sent to and from the server.
    [DATA]: strToU8(JSON.stringify(file.data)),
  };
  // Pictures are compressed already: stored as they are.
  for (const image of images) {
    entries[`images/${image.patientId}.${image.ext}`] = [image.bytes, { level: 0 }];
  }
  return zipSync(entries, { level: 6 });
}

/**
 * A picture an import accepts: within the size limit, and WebP ("RIFF....WEBP") or JPEG
 * (FF D8 FF) as the app itself writes. Export checks the same, so no file it saves is refused.
 */
export function isImportableImage(bytes: Uint8Array, ext: "webp" | "jpg"): boolean {
  if (bytes.byteLength > BACKUP_LIMITS.imageBytes) return false;
  if (ext === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return strFromU8(bytes.subarray(0, 4)) === "RIFF" && strFromU8(bytes.subarray(8, 12)) === "WEBP";
}

export type UnpackResult =
  | { ok: true; file: BackupFile; images: BackupImage[] }
  | { ok: false; reason: "broken" | "newer" | "tooLarge" };

class TooLargeError extends Error {}
class BrokenError extends Error {}

/**
 * Opens a backup `.zip`: its two JSON files and its avatars, within the size limits. A picture
 * of a patient not in the file is skipped; one that is too big or not an image makes the file
 * broken. Never throws.
 */
export function unpackBackup(bytes: Uint8Array): UnpackResult {
  let entries: Record<string, Uint8Array>;
  try {
    let unpacked = 0;
    entries = unzipSync(bytes, {
      filter: (entry) => {
        if (entry.name !== MANIFEST && entry.name !== DATA) return false;
        unpacked += entry.originalSize;
        if (unpacked > BACKUP_LIMITS.dataUnpackedBytes) throw new TooLargeError();
        return true;
      },
    });
  } catch (error) {
    return { ok: false, reason: error instanceof TooLargeError ? "tooLarge" : "broken" };
  }

  const manifest = entries[MANIFEST];
  const data = entries[DATA];
  if (!manifest || !data) return { ok: false, reason: "broken" };
  let result: ReturnType<typeof readBackup>;
  try {
    result = readBackup(JSON.parse(strFromU8(manifest)), JSON.parse(strFromU8(data)));
  } catch {
    return { ok: false, reason: "broken" };
  }
  if (!result.ok) return result;

  // Second pass, now that the patients are known: their pictures only, one each.
  const patients = new Set(result.file.data.patients.map((patient) => patient.id));
  const wanted = new Set<string>();
  try {
    let unpacked = 0;
    entries = unzipSync(bytes, {
      filter: (entry) => {
        const patientId = BACKUP_IMAGE_NAME.exec(entry.name)?.[1];
        if (!patientId || !patients.has(patientId) || wanted.has(patientId)) return false;
        if (entry.originalSize > BACKUP_LIMITS.imageBytes) throw new BrokenError();
        unpacked += entry.originalSize;
        if (unpacked > BACKUP_LIMITS.unpackedBytes) throw new TooLargeError();
        wanted.add(patientId);
        return true;
      },
    });
  } catch (error) {
    return { ok: false, reason: error instanceof TooLargeError ? "tooLarge" : "broken" };
  }
  const images: BackupImage[] = [];
  for (const [name, content] of Object.entries(entries)) {
    const match = BACKUP_IMAGE_NAME.exec(name);
    const patientId = match?.[1];
    const ext = match?.[2] === "jpg" ? "jpg" : "webp";
    if (!patientId || !patients.has(patientId)) continue;
    if (!isImportableImage(content, ext)) {
      return { ok: false, reason: "broken" };
    }
    images.push({ patientId, ext, bytes: content });
  }
  return { ok: true, file: result.file, images };
}

/** JSON → gzip: what travels to and from `/api/backup`. */
export function gzipJson(value: unknown): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(value)));
}

export function gunzipJson(bytes: Uint8Array): unknown {
  return JSON.parse(strFromU8(gunzipSync(bytes)));
}
