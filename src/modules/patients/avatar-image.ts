import { AVATAR_LIMITS, AVATAR_MESSAGES } from "@/modules/patients/constants";

/**
 * Shrinks a picture from the camera or gallery into an avatar, in the browser (spec
 * patient-avatars, design §2): the largest centred square, scaled to 384 × 384, as WebP (JPEG
 * where the browser cannot encode WebP). 20–40 KB instead of several MB, before anything is sent.
 */

export class AvatarImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarImageError";
  }
}

export type AvatarImage = { blob: Blob; format: "webp" | "jpg" };

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function toAvatarImage(file: File): Promise<AvatarImage> {
  if (file.size > AVATAR_LIMITS.inputBytes) throw new AvatarImageError(AVATAR_MESSAGES.tooLarge);
  // Some browsers leave the type empty for HEIC; let the decoder decide then.
  if (file.type && !file.type.startsWith("image/")) {
    throw new AvatarImageError(AVATAR_MESSAGES.unreadable);
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image": a portrait photo from a phone keeps its orientation (EXIF).
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      // Older engines reject that option value; they apply EXIF orientation by default anyway.
      bitmap = await createImageBitmap(file);
    } catch {
      throw new AvatarImageError(AVATAR_MESSAGES.unreadable);
    }
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_LIMITS.size;
  canvas.height = AVATAR_LIMITS.size;
  const context = canvas.getContext("2d");
  if (!context || side === 0) {
    bitmap.close();
    throw new AvatarImageError(AVATAR_MESSAGES.unreadable);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_LIMITS.size,
    AVATAR_LIMITS.size,
  );
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", AVATAR_LIMITS.webpQuality);
  if (webp && webp.type === "image/webp") return { blob: webp, format: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", AVATAR_LIMITS.jpegQuality);
  if (jpeg) return { blob: jpeg, format: "jpg" };
  throw new AvatarImageError(AVATAR_MESSAGES.unreadable);
}
