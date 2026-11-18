import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { gunzipJson, gzipJson, packBackup, unpackBackup } from "@/modules/backup/archive";
import { BACKUP_LIMITS } from "@/modules/backup/constants";
import { readBackup } from "@/modules/backup/format";
import { PATIENT_AN, sampleBackup } from "@/modules/backup/test-fixtures";
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
    expect(unpackBackup(packBackup(file))).toEqual({ ok: true, file, images: [] });
  });

  const WEBP = new Uint8Array([...strToU8("RIFF"), 0, 0, 0, 0, ...strToU8("WEBPVP8L"), 1, 2]);

  it("round-trips avatars under images/", () => {
    const file = checked();
    const image = { patientId: PATIENT_AN, ext: "webp" as const, bytes: WEBP };
    const result = unpackBackup(packBackup(file, [image]));
    expect(result).toMatchObject({ ok: true, images: [image] });
  });

  it("skips a picture of a patient not in the file", () => {
    const stranger = {
      patientId: "9b5f8a52-6b8e-4f3c-9a51-0f6f3f1e2a09",
      ext: "webp" as const,
      bytes: WEBP,
    };
    expect(unpackBackup(packBackup(checked(), [stranger]))).toMatchObject({ ok: true, images: [] });
  });

  it("treats a picture that is not an image as broken", () => {
    const fake = { patientId: PATIENT_AN, ext: "webp" as const, bytes: strToU8("<script>") };
    expect(unpackBackup(packBackup(checked(), [fake]))).toEqual({ ok: false, reason: "broken" });
  });

  it("reads a format 1 file (no pictures) by upgrading it", () => {
    const backup = sampleBackup();
    const { images: _images, ...v1Counts } = backup.manifest.counts;
    const zip = zipSync({
      "manifest.json": strToU8(
        JSON.stringify({ ...backup.manifest, formatVersion: 1, counts: v1Counts }),
      ),
      "data.json": strToU8(JSON.stringify(backup.data)),
    });
    const result = unpackBackup(zip);
    expect(result).toMatchObject({ ok: true, images: [] });
    expect(result.ok && result.file.manifest).toMatchObject({
      formatVersion: 2,
      counts: { images: 0 },
    });
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
