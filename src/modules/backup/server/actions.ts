"use server";

import { z } from "zod";

import { recordBackup } from "@/modules/backup/server/mutations";
import { createAction } from "@/server/actions/create-action";

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
