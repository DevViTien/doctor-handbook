import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { AccessCodeType, AccountStatus } from "@/lib/enums";
import { accessCodeIsUsable } from "@/server/auth/access-codes";
import { invalidateAccountSessions } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accessCodes, accounts } from "@/server/db/schema";

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

/** The only accounts the admin may lock or unlock: doctors (never the admin account). */
export function doctorAccountById(id: string) {
  return and(eq(accounts.id, id), eq(accounts.role, "doctor"));
}

/**
 * Locks or unlocks a DOCTOR account (design §2). Locking also deletes every session of the
 * account in the same transaction, ending all devices at once (S8). Unlocking deletes nothing:
 * no session can exist while an account is locked (`createSession` refuses locked accounts), so
 * a session ended by a lock never comes back, and an unlock clicked twice never signs out a
 * doctor already working again. Idempotent. Returns false when no doctor account has this id
 * (unknown id, or the admin account).
 */
export async function setDoctorAccountStatus(
  id: string,
  status: AccountStatus,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(accounts)
      .set({ status })
      .where(doctorAccountById(id))
      .returning({ id: accounts.id });
    if (rows.length === 0) return false;

    if (status === "locked") await invalidateAccountSessions(id, {}, tx);
    return true;
  });
}
