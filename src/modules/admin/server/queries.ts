import "server-only";

import { desc, eq } from "drizzle-orm";

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
  usedByUsername: string | null;
};

/** Activation codes, newest first (spec access-codes "Danh sách mã theo trạng thái"). */
export async function listAccessCodes(db: DbExecutor = getDb()): Promise<AccessCodeListItem[]> {
  return db
    .select({
      id: accessCodes.id,
      recipientName: accessCodes.recipientName,
      createdAt: accessCodes.createdAt,
      expiresAt: accessCodes.expiresAt,
      usedAt: accessCodes.usedAt,
      revokedAt: accessCodes.revokedAt,
      usedByUsername: accounts.username,
    })
    .from(accessCodes)
    .leftJoin(accounts, eq(accessCodes.accountId, accounts.id))
    .where(eq(accessCodes.type, "activation"))
    .orderBy(desc(accessCodes.createdAt))
    .limit(ACCESS_CODE_LIST_LIMIT);
}
