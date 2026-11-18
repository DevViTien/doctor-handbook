import "server-only";

import { desc, eq } from "drizzle-orm";

import type { AccessCodeType, AccountStatus } from "@/lib/enums";
import { ACCESS_CODE_LIST_LIMIT } from "@/modules/admin/constants";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accessCodes, accounts } from "@/server/db/schema";

/**
 * One row of the admin's code list. Never includes `code_hash`, and from `accounts` only the
 * username of the account an activation code created (idea.md N6: no patient data here).
 */
export type AccessCodeListItem = {
  id: string;
  recipientName: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  type: AccessCodeType;
  /** Activation: the account the code created. Password reset: the account it is for. */
  accountUsername: string | null;
};

/** Every access code (both kinds), newest first (spec access-codes "Danh sách mã theo trạng thái"). */
export async function listAccessCodes(db: DbExecutor = getDb()): Promise<AccessCodeListItem[]> {
  return db
    .select({
      id: accessCodes.id,
      recipientName: accessCodes.recipientName,
      createdAt: accessCodes.createdAt,
      expiresAt: accessCodes.expiresAt,
      usedAt: accessCodes.usedAt,
      revokedAt: accessCodes.revokedAt,
      type: accessCodes.type,
      accountUsername: accounts.username,
    })
    .from(accessCodes)
    .leftJoin(accounts, eq(accessCodes.accountId, accounts.id))
    .orderBy(desc(accessCodes.createdAt), desc(accessCodes.id))
    .limit(ACCESS_CODE_LIST_LIMIT);
}

/** One doctor account in the admin's list: no password hash, no patient data (N6). */
export type DoctorAccountListItem = {
  id: string;
  displayName: string;
  username: string;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
};

/** Doctor accounts, newest first (spec account-management). The admin account is excluded. */
export async function listDoctorAccounts(
  db: DbExecutor = getDb(),
): Promise<DoctorAccountListItem[]> {
  return (
    db
      .select({
        id: accounts.id,
        displayName: accounts.displayName,
        username: accounts.username,
        status: accounts.status,
        createdAt: accounts.createdAt,
        lastLoginAt: accounts.lastLoginAt,
      })
      .from(accounts)
      .where(eq(accounts.role, "doctor"))
      // `id` breaks ties so rows never swap places between renders.
      .orderBy(desc(accounts.createdAt), desc(accounts.id))
  );
}
