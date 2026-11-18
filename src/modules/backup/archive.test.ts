import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { gunzipJson, gzipJson, packBackup, unpackBackup } from "@/modules/backup/archive";
import { BACKUP_LIMITS } from "@/modules/backup/constants";
import { readBackup } from "@/modules/backup/format";
import { sampleBackup } from "@/modules/backup/test-fixtures";
import type { BackupFile } from "@/modules/backup/types";

function checked(): BackupFile {
  const backup = sampleBackup();
  const result = readBackup(backup.manifest, backup.data);
  if (!result.ok) throw new Error("fixture is invalid");
  return result.file;
}

describe("packBackup / unpackBackup", () => {
  it("round-trips a backup through the .zip", () => {
    const file = checked();
    expect(unpackBackup(packBackup(file))).toEqual({ ok: true, file });
  });

  it("treats a zip without manifest.json as broken", () => {
    const zip = zipSync({ "data.json": strToU8("{}") });
    expect(unpackBackup(zip)).toEqual({ ok: false, reason: "broken" });
  });

  it("treats bytes that are not a zip as broken", () => {
    expect(unpackBackup(strToU8("not a zip at all"))).toEqual({ ok: false, reason: "broken" });
  });

  it("treats invalid JSON inside as broken", () => {
    const zip = zipSync({ "manifest.json": strToU8("{"), "data.json": strToU8("{}") });
    expect(unpackBackup(zip)).toEqual({ ok: false, reason: "broken" });
  });

  it("refuses contents larger than the unpacked limit", () => {
    // Zeros compress to almost nothing: a tiny zip announcing a huge file.
    const zip = zipSync({
      "manifest.json": strToU8("{}"),
      "data.json": new Uint8Array(BACKUP_LIMITS.unpackedBytes + 1),
    });
    expect(zip.byteLength).toBeLessThan(BACKUP_LIMITS.fileBytes);
    expect(unpackBackup(zip)).toEqual({ ok: false, reason: "tooLarge" });
  });
});

describe("gzipJson / gunzipJson", () => {
  it("round-trips JSON", () => {
    const file = checked();
    expect(gunzipJson(gzipJson(file))).toEqual(file);
  });
});
