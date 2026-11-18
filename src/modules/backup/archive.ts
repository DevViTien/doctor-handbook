import { gunzipSync, gzipSync, strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { BACKUP_LIMITS } from "@/modules/backup/constants";
import { readBackup } from "@/modules/backup/format";
import type { BackupFile } from "@/modules/backup/types";

/**
 * The `.zip` itself, built and opened in the browser only (design §3–§4): it never goes to the
 * server. Plain JSON inside, so a doctor (or a future tool) can read it without this app.
 */

const MANIFEST = "manifest.json";
const DATA = "data.json";

export function packBackup(file: BackupFile): Uint8Array {
  return zipSync(
    {
      [MANIFEST]: strToU8(JSON.stringify(file.manifest, null, 2)),
      // Compact: the same size budget as the JSON sent to and from the server.
      [DATA]: strToU8(JSON.stringify(file.data)),
    },
    { level: 6 },
  );
}

export type UnpackResult =
  { ok: true; file: BackupFile } | { ok: false; reason: "broken" | "newer" | "tooLarge" };

class TooLargeError extends Error {}

/** Opens a backup `.zip`: only its two JSON files, within the unpacked size limit. Never throws. */
export function unpackBackup(bytes: Uint8Array): UnpackResult {
  let entries: Record<string, Uint8Array>;
  try {
    let unpacked = 0;
    entries = unzipSync(bytes, {
      filter: (entry) => {
        if (entry.name !== MANIFEST && entry.name !== DATA) return false;
        unpacked += entry.originalSize;
        if (unpacked > BACKUP_LIMITS.unpackedBytes) throw new TooLargeError();
        return true;
      },
    });
  } catch (error) {
    return { ok: false, reason: error instanceof TooLargeError ? "tooLarge" : "broken" };
  }

  const manifest = entries[MANIFEST];
  const data = entries[DATA];
  if (!manifest || !data) return { ok: false, reason: "broken" };
  try {
    return readBackup(JSON.parse(strFromU8(manifest)), JSON.parse(strFromU8(data)));
  } catch {
    return { ok: false, reason: "broken" };
  }
}

/** JSON → gzip: what travels to and from `/api/backup`. */
export function gzipJson(value: unknown): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(value)));
}

export function gunzipJson(bytes: Uint8Array): unknown {
  return JSON.parse(strFromU8(gunzipSync(bytes)));
}
