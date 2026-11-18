"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import type { AccountStatus } from "@/lib/enums";
import { AppError } from "@/lib/errors";
import { ACCOUNT_MESSAGES, ADMIN_MESSAGES } from "@/modules/admin/constants";
import {
  accountIdSchema,
  createAccessCodeSchema,
  revokeAccessCodeSchema,
} from "@/modules/admin/schemas";
import {
  insertAccessCode,
  revokeAccessCode,
  setDoctorAccountStatus,
} from "@/modules/admin/server/mutations";
import { createAction, createFormAction } from "@/server/actions/create-action";
import { ACCESS_CODE_TTL_MS } from "@/server/auth/constants";
import { formatAccessCode, generateAccessCode, hashAccessCode } from "@/server/auth/crypto";
import { isUniqueViolation } from "@/server/db/errors";

/** What the admin sees once, right after creating a code. Never stored, never logged. */
export type IssuedAccessCode = {
  /** Formatted for reading aloud and pasting, e.g. "K7HM-3QXR". */
  code: string;
  recipientName: string;
  /** ISO timestamp (serializable across the action boundary). */
  expiresAt: string;
};

/** A hash collision of two 40-bit codes is ~1e-12; a few retries make it a non-event. */
const MAX_CODE_ATTEMPTS = 3;

/**
 * Issues an activation code (spec access-codes). Only its HMAC is stored, so the code exists
 * only in this response (design §5).
 */
export const createAccessCodeFormAction = createFormAction(
  { name: "admin.createAccessCode", schema: createAccessCodeSchema, access: "admin" },
  async (input, { auth }): Promise<IssuedAccessCode> => {
    const expiresAt = new Date(Date.now() + ACCESS_CODE_TTL_MS);

    for (let attempt = 1; ; attempt++) {
      const code = generateAccessCode();
      try {
        await insertAccessCode({
          type: "activation",
          codeHash: hashAccessCode(code),
          recipientName: input.recipientName,
          expiresAt,
          createdById: auth.account.id,
        });
      } catch (error) {
        if (attempt < MAX_CODE_ATTEMPTS && isUniqueViolation(error, "access_codes_code_hash_key")) {
          continue;
        }
        throw error;
      }

      revalidatePath(routes.admin.accessCodes);
      return {
        code: formatAccessCode(code),
        recipientName: input.recipientName,
        expiresAt: expiresAt.toISOString(),
      };
    }
  },
);

/** Revokes a code that is still usable; anything else is a CONFLICT (spec "Huỷ mã chưa dùng"). */
export const revokeAccessCodeAction = createAction(
  { name: "admin.revokeAccessCode", schema: revokeAccessCodeSchema, access: "admin" },
  async (input): Promise<{ id: string }> => {
    // On a conflict the page is NOT revalidated here: the row (and the dialog showing the error)
    // would disappear before the admin reads why. The client refreshes when the dialog closes.
    if (!(await revokeAccessCode(input.id))) {
      throw new AppError("CONFLICT", ADMIN_MESSAGES.revokeConflict);
    }
    revalidatePath(routes.admin.accessCodes);
    return { id: input.id };
  },
);

export type AccountStatusChange = { id: string; status: AccountStatus };

async function changeAccountStatus(
  id: string,
  status: AccountStatus,
): Promise<AccountStatusChange> {
  if (!(await setDoctorAccountStatus(id, status))) {
    throw new AppError("NOT_FOUND", ACCOUNT_MESSAGES.notFound);
  }
  revalidatePath(routes.admin.accounts);
  return { id, status };
}

/** Locks a doctor account and ends all its sessions at once (spec "Khoá tài khoản"). */
export const lockAccountAction = createAction(
  { name: "admin.lockAccount", schema: accountIdSchema, access: "admin" },
  async (input) => changeAccountStatus(input.id, "locked"),
);

/** Unlocks a doctor account; sessions ended by the lock stay ended (spec "Mở khoá tài khoản"). */
export const unlockAccountAction = createAction(
  { name: "admin.unlockAccount", schema: accountIdSchema, access: "admin" },
  async (input) => changeAccountStatus(input.id, "active"),
);
