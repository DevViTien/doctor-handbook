import { z } from "zod";

import { ADMIN_MESSAGES, RECIPIENT_NAME_MAX_LENGTH } from "@/modules/admin/constants";

/** Shared by the "create access code" form and its Server Action. */
export const createAccessCodeSchema = z.object({
  recipientName: z
    .string(ADMIN_MESSAGES.recipientRequired)
    .trim()
    .min(1, ADMIN_MESSAGES.recipientRequired)
    .max(RECIPIENT_NAME_MAX_LENGTH, ADMIN_MESSAGES.recipientTooLong),
});

export const revokeAccessCodeSchema = z.object({ id: z.uuid() });

export type CreateAccessCodeInput = z.input<typeof createAccessCodeSchema>;
export type RevokeAccessCodeInput = z.input<typeof revokeAccessCodeSchema>;
