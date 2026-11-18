"use server";

import { z } from "zod";

import { BACKUP_LIMITS, IMPORT_UPLOADS_PER_REQUEST } from "@/modules/backup/constants";
import { recordBackup } from "@/modules/backup/server/mutations";
import { usedAvatarPaths } from "@/modules/backup/server/queries";
import { createAction } from "@/server/actions/create-action";
import {
  createSignedUploadUrl,
  isAvatarPathOf,
  newAvatarObjectPath,
  removeAvatarsQuietly,
  STORAGE_BUCKETS,
} from "@/server/storage/objects";

/**
 * Called by the browser once a backup file is saved (design §3, step 5). Takes nothing: the time
 * is the database's and the account the session's.
 */
export const recordBackupAction = createAction(
  { name: "backup.record", schema: z.object({}), access: "doctor" },
  async (_input, { auth }): Promise<{ recorded: true }> => {
    await recordBackup(auth);
    return { recorded: true };
  },
);

/**
 * Before an import (design §5): one signed upload URL per avatar in the file, each a fresh
 * random path under the session's account. Nothing points at them until the import commits.
 */
export const prepareImportUploadsAction = createAction(
  {
    name: "backup.import.prepareUploads",
    schema: z.object({
      formats: z.array(z.enum(["webp", "jpg"])).max(IMPORT_UPLOADS_PER_REQUEST),
    }),
    access: "doctor",
  },
  async ({ formats }, { auth }): Promise<{ uploads: { uploadUrl: string; path: string }[] }> => {
    const uploads: { uploadUrl: string; path: string }[] = [];
    for (let start = 0; start < formats.length; start += 20) {
      const batch = await Promise.all(
        formats.slice(start, start + 20).map(async (format) => {
          const path = newAvatarObjectPath(auth.account.id, format);
          const { signedUrl } = await createSignedUploadUrl(STORAGE_BUCKETS.avatars, path);
          return { uploadUrl: signedUrl, path };
        }),
      );
      uploads.push(...batch);
    }
    return { uploads };
  },
);

/**
 * After a failed import: deletes what was uploaded for it. Only paths of this account that no
 * patient uses: a tampered call can never delete a picture still shown.
 */
export const discardImportUploadsAction = createAction(
  {
    name: "backup.import.discardUploads",
    schema: z.object({ paths: z.array(z.string().max(200)).max(BACKUP_LIMITS.patients) }),
    access: "doctor",
  },
  async ({ paths }, { auth }): Promise<{ discarded: number }> => {
    const own = paths.filter((path) => isAvatarPathOf(auth.account.id, path));
    const used = await usedAvatarPaths(auth, own);
    const unused = own.filter((path) => !used.has(path));
    await removeAvatarsQuietly(unused);
    return { discarded: unused.length };
  },
);
