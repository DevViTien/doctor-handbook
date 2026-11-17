import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/errors";

import { getStorage } from "./client";

/** Private buckets. Create them in Supabase with "Public bucket" turned OFF. */
export const STORAGE_BUCKETS = {
  avatars: "avatars",
  /** Temporary uploads while importing a backup file. */
  imports: "imports",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * An object path that is guaranteed to live under one account's prefix.
 * Storage functions only accept this type, so a raw string can never reach them.
 */
export type AccountObjectPath = string & { readonly __brand: "AccountObjectPath" };

/** Letters, digits, dot, dash, underscore — but never "." or ".." (path traversal). */
const SAFE_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,128}$/;
const accountIdSchema = z.uuid();

/**
 * Builds `<accountId>/<...segments>`. Every object lives under its owner's account id,
 * which keeps one doctor's files out of another doctor's prefix.
 */
export function accountObjectPath(accountId: string, ...segments: string[]): AccountObjectPath {
  if (!accountIdSchema.safeParse(accountId).success || segments.length === 0) {
    throw new AppError("VALIDATION_FAILED");
  }
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment)) throw new AppError("VALIDATION_FAILED");
  }
  return [accountId, ...segments].join("/") as AccountObjectPath;
}

/** Short-lived URL to display a private object. */
export async function createSignedReadUrl(
  bucket: StorageBucket,
  path: AccountObjectPath,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const { data, error } = await getStorage().from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw new AppError("INTERNAL", undefined, { cause: error });
  return data.signedUrl;
}

/** URL the browser uploads to directly, keeping large files off Vercel functions. */
export async function createSignedUploadUrl(
  bucket: StorageBucket,
  path: AccountObjectPath,
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await getStorage()
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw new AppError("INTERNAL", undefined, { cause: error });
  return data;
}

export async function removeObjects(
  bucket: StorageBucket,
  paths: readonly AccountObjectPath[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getStorage()
    .from(bucket)
    .remove([...paths]);
  if (error) throw new AppError("INTERNAL", undefined, { cause: error });
}
