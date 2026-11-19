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

/** Lock / unlock: the account to act on. */
export const accountIdSchema = z.object({ id: z.uuid() });

/**
 * Delete an account: the account and the username the admin typed. An empty or wrong username
 * still passes here and is refused by the DAL, so the admin always reads "Tên đăng nhập không
 * khớp." rather than a generic validation error.
 */
export const deleteAccountSchema = z.object({ id: z.uuid(), username: z.string().max(64) });

export type CreateAccessCodeInput = z.input<typeof createAccessCodeSchema>;
export type RevokeAccessCodeInput = z.input<typeof revokeAccessCodeSchema>;
export type AccountIdInput = z.input<typeof accountIdSchema>;
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>;
