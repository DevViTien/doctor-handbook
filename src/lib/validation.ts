import { z } from "zod";

/**
 * Reusable Zod building blocks. Feature schemas (in `src/modules/<feature>/schemas.ts`)
 * compose these so that trimming, empty-string handling and limits stay consistent.
 */

export const idSchema = z.uuid();

/** Required free text: trimmed, non-empty, bounded. */
export function requiredText(maxLength: number) {
  return z.string().trim().min(1).max(maxLength);
}

/** Optional free text: trimmed; empty strings from form inputs become `null`. */
export function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => (value ? value : null));
}

/** Login names: lowercase latin letters, digits, dot and underscore. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,32}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Tên đăng nhập gồm 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới.");

/** Length-only rule on purpose: complex composition rules hurt typing on phones. */
export const passwordSchema = z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự.").max(128);
