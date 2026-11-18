import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import { AppError } from "@/lib/errors";
import { logger } from "@/server/logger";

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

/** Avatar object names: 32 random hex digits (no patient id in it), WebP or JPEG. */
const AVATAR_NAME = /^[0-9a-f]{32}\.(webp|jpg)$/;

/** A fresh, unguessable avatar path under the account's prefix (a new one for every upload). */
export function newAvatarObjectPath(accountId: string, ext: "webp" | "jpg"): AccountObjectPath {
  return accountObjectPath(accountId, `${randomBytes(16).toString("hex")}.${ext}`);
}

/**
 * Whether a path sent back by a browser is an avatar path of THIS account: exactly
 * `<accountId>/<32 hex>.(webp|jpg)`. Anything else (another account, `..`, sub-folders) is not.
 */
export function isAvatarPathOf(accountId: string, path: string): path is AccountObjectPath {
  const [owner, name, ...rest] = path.split("/");
  return owner === accountId && rest.length === 0 && AVATAR_NAME.test(name ?? "");
}

/**
 * A path read back from the database (written only after `isAvatarPathOf`), for maintenance
 * that spans accounts (the daily purge). `null` for anything that does not look like one.
 */
export function storedAvatarPath(path: string | null): AccountObjectPath | null {
  if (!path) return null;
  const [owner] = path.split("/");
  return owner && accountIdSchema.safeParse(owner).success && isAvatarPathOf(owner, path)
    ? path
    : null;
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

/** Signed read URLs for many objects in one call; a missing object maps to `null`. */
export async function createSignedReadUrls(
  bucket: StorageBucket,
  paths: readonly AccountObjectPath[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string | null>> {
  const urls = new Map<string, string | null>();
  if (paths.length === 0) return urls;
  const { data, error } = await getStorage()
    .from(bucket)
    .createSignedUrls([...paths], expiresInSeconds);
  if (error) throw new AppError("INTERNAL", undefined, { cause: error });
  for (const entry of data) {
    if (entry.path) urls.set(entry.path, entry.error ? null : entry.signedUrl);
  }
  return urls;
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

/**
 * Deletes avatars whose rows are already gone (permanent delete, purge, import, a replaced
 * picture). Best effort: a failure is logged with a count only and never undoes the delete; an
 * orphan object is unreachable (no row points at it, its name is random).
 */
export async function removeAvatarsQuietly(paths: ReadonlyArray<string | null>): Promise<void> {
  const valid = paths.map(storedAvatarPath).filter((path) => path !== null);
  for (let start = 0; start < valid.length; start += 1000) {
    const batch = valid.slice(start, start + 1000);
    try {
      await removeObjects(STORAGE_BUCKETS.avatars, batch);
    } catch (error) {
      logger.warn("Avatar cleanup failed", { count: batch.length, error });
    }
  }
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
