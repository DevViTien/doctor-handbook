import { deflateSync } from "node:zlib";

import { FAKE_STORAGE_URL } from "./constants";

/**
 * Helpers around the fake Supabase Storage (tests/e2e/fake-storage.mjs) and small images for
 * the avatar tests (change add-patient-avatars). Keys are "<bucket>/<path>".
 */

export type StoredObject = { key: string; size: number; type: string };

export async function listStoredObjects(prefix = ""): Promise<StoredObject[]> {
  const response = await fetch(
    `${FAKE_STORAGE_URL}/__fake/objects?prefix=${encodeURIComponent(prefix)}`,
  );
  return (await response.json()) as StoredObject[];
}

export async function readStoredObject(key: string): Promise<Buffer> {
  const response = await fetch(`${FAKE_STORAGE_URL}/__fake/object?key=${encodeURIComponent(key)}`);
  if (!response.ok) throw new Error(`No stored object ${key}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function putStoredObject(key: string, bytes: Buffer, type = "image/webp") {
  await fetch(`${FAKE_STORAGE_URL}/__fake/object?key=${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": type },
    body: new Uint8Array(bytes),
  });
}

export async function resetStorage(): Promise<void> {
  await fetch(`${FAKE_STORAGE_URL}/__fake/objects`, { method: "DELETE" }).catch(() => undefined);
}

// --- Images ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A solid-colour PNG, with a darker square in the middle (so a centre crop is visible). */
export function makePng(
  width: number,
  height: number,
  rgb: [number, number, number] = [80, 140, 200],
) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const centre = Math.abs(x - width / 2) < width / 6 && Math.abs(y - height / 2) < height / 6;
      row[1 + x * 3] = centre ? rgb[0] / 2 : rgb[0];
      row[2 + x * 3] = centre ? rgb[1] / 2 : rgb[1];
      row[3 + x * 3] = centre ? rgb[2] / 2 : rgb[2];
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Width × height of a PNG, WebP (VP8, VP8L, VP8X) or JPEG image. */
export function imageSize(bytes: Buffer): { width: number; height: number; format: string } {
  if (bytes.readUInt32BE(0) === 0x89504e47) {
    // PNG: IHDR right after the signature; colour type 2 = RGB (opaque), 6 = RGBA.
    return {
      format: bytes[25] === 6 ? "png-rgba" : "png",
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const kind = bytes.toString("ascii", 12, 16);
    if (kind === "VP8 ") {
      return {
        format: "webp",
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (kind === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") {
      return {
        format: "webp",
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      const marker = bytes[offset + 1] ?? 0;
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          format: "jpeg",
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  throw new Error("Unknown image format");
}

/** A tiny real WebP (a 1×1 lossless pixel), for seeding stored avatars. */
export const TINY_WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
