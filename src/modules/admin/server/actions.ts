"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import type { AccessCodeType, AccountStatus } from "@/lib/enums";
import { AppError } from "@/lib/errors";
import { ACCOUNT_MESSAGES, ADMIN_MESSAGES } from "@/modules/admin/constants";
import {
  accountIdSchema,
  createAccessCodeSchema,
  deleteAccountSchema,
  revokeAccessCodeSchema,
} from "@/modules/admin/schemas";
import {
  deleteDoctorAccount,
  insertAccessCode,
  issuePasswordResetCode,
  revokeAccessCode,
  setDoctorAccountStatus,
} from "@/modules/admin/server/mutations";
import { createAction, createFormAction } from "@/server/actions/create-action";
import { ACCESS_CODE_TTL_MS } from "@/server/auth/constants";
import { formatAccessCode, generateAccessCode, hashAccessCode } from "@/server/auth/crypto";
import { isUniqueViolation } from "@/server/db/errors";
import { logger } from "@/server/logger";

/** What the admin sees once, right after creating a code. Never stored, never logged. */
export type IssuedAccessCode = {
  kind: AccessCodeType;
  /** Formatted for reading aloud and pasting, e.g. "K7HM-3QXR". */
  code: string;
  recipientName: string;
  /** Password reset: the account the code is for. */
  username?: string;
  /** ISO timestamp (serializable across the action boundary). */
  expiresAt: string;
};

/** A hash collision of two 40-bit codes is ~1e-12; a few retries make it a non-event. */
const MAX_CODE_ATTEMPTS = 3;

/**
 * Generates a code and stores it through `store` (which receives only its hash), retrying with
 * a new code on the rare hash collision. Returns the formatted code with `store`'s result.
 * Not exported: "use server" files may only export actions.
 */
async function issueCode<T>(
  store: (codeHash: string) => Promise<T>,
): Promise<{ code: string; stored: T }> {
  for (let attempt = 1; ; attempt++) {
    const code = generateAccessCode();
    try {
      return { code: formatAccessCode(code), stored: await store(hashAccessCode(code)) };
    } catch (error) {
      if (attempt < MAX_CODE_ATTEMPTS && isUniqueViolation(error, "access_codes_code_hash_key")) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Issues an activation code (spec access-codes). Only its HMAC is stored, so the code exists
 * only in this response (design §5).
 */
export const createAccessCodeFormAction = createFormAction(
  { name: "admin.createAccessCode", schema: createAccessCodeSchema, access: "admin" },
  async (input, { auth }): Promise<IssuedAccessCode> => {
    const expiresAt = new Date(Date.now() + ACCESS_CODE_TTL_MS);
    const { code } = await issueCode((codeHash) =>
      insertAccessCode({
        type: "activation",
        codeHash,
        recipientName: input.recipientName,
        expiresAt,
        createdById: auth.account.id,
      }),
    );

    revalidatePath(routes.admin.accessCodes);
    return {
      kind: "activation",
      code,
      recipientName: input.recipientName,
      expiresAt: expiresAt.toISOString(),
    };
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

/**
 * Issues a password-reset code for an active doctor account (spec access-codes "Admin cấp mã
 * đặt lại mật khẩu"). Earlier usable reset codes of the account are revoked. The code is only
 * in this response.
 */
export const createPasswordResetCodeAction = createAction(
  { name: "admin.createPasswordResetCode", schema: accountIdSchema, access: "admin" },
  async (input, { auth }): Promise<IssuedAccessCode> => {
    const expiresAt = new Date(Date.now() + ACCESS_CODE_TTL_MS);
    const { code, stored } = await issueCode((codeHash) =>
      issuePasswordResetCode(input.id, { codeHash, expiresAt, createdById: auth.account.id }),
    );

    if (stored.status === "not-found") throw new AppError("NOT_FOUND", ACCOUNT_MESSAGES.notFound);
    if (stored.status === "locked") {
      // Nothing was stored: the row is shown with its real state after a refresh.
      throw new AppError("CONFLICT", ACCOUNT_MESSAGES.lockedNoReset);
    }

    revalidatePath(routes.admin.accessCodes);
    revalidatePath(routes.admin.accounts);
    return {
      kind: "password_reset",
      code,
      recipientName: stored.displayName,
      username: stored.username,
      expiresAt: expiresAt.toISOString(),
    };
  },
);

/**
 * Deletes a locked doctor account and all its data, once the admin typed its username (spec
 * account-management "Xoá tài khoản đã khoá"). Refusals change nothing; on a refusal the page is
 * NOT revalidated (the dialog would vanish before the reason is read), the client refreshes
 * when the dialog closes. Only ids and counts are logged.
 */
export const deleteAccountAction = createAction(
  { name: "admin.deleteAccount", schema: deleteAccountSchema, access: "admin" },
  async (input): Promise<{ username: string }> => {
    let outcome;
    try {
      outcome = await deleteDoctorAccount(input.id, input.username);
    } catch (error) {
      // Storage (or the database) failed: the transaction rolled back, the account is still
      // there and still locked, so the admin can simply try again.
      logger.error("Account deletion failed", { accountId: input.id, error });
      throw new AppError("INTERNAL", ACCOUNT_MESSAGES.deleteFailed);
    }

    if (outcome.status === "not-found") throw new AppError("NOT_FOUND", ACCOUNT_MESSAGES.notFound);
    if (outcome.status === "active") {
      throw new AppError("CONFLICT", ACCOUNT_MESSAGES.activeNoDelete);
    }
    if (outcome.status === "mismatch") {
      throw new AppError("VALIDATION_FAILED", ACCOUNT_MESSAGES.usernameMismatch);
    }

    logger.info("Doctor account deleted", {
      accountId: input.id,
      removedObjects: outcome.removedObjects,
    });
    revalidatePath(routes.admin.accounts);
    revalidatePath(routes.admin.accessCodes);
    return { username: outcome.username };
  },
);
