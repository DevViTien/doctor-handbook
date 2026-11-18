import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { AccessCodeType } from "@/lib/enums";
import { accessCodeIsUsable } from "@/server/auth/access-codes";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accessCodes } from "@/server/db/schema";

export type NewAccessCode = {
  type: AccessCodeType;
  /** `hashAccessCode(code)`: the raw code is never stored. */
  codeHash: string;
  recipientName: string;
  expiresAt: Date;
  createdById: string;
};

export async function insertAccessCode(
  values: NewAccessCode,
  db: DbExecutor = getDb(),
): Promise<{ id: string }> {
  const [row] = await db.insert(accessCodes).values(values).returning({ id: accessCodes.id });
  if (!row) throw new Error("insertAccessCode returned no row");
  return row;
}

/**
 * Revokes a code only while it is still usable (not used, not revoked, not expired), in one
 * conditional UPDATE so a code used a moment earlier is never marked revoked.
 * Returns false when nothing was revoked.
 */
export async function revokeAccessCode(id: string, db: DbExecutor = getDb()): Promise<boolean> {
  const rows = await db
    .update(accessCodes)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(accessCodes.id, id), accessCodeIsUsable()))
    .returning({ id: accessCodes.id });
  return rows.length > 0;
}
