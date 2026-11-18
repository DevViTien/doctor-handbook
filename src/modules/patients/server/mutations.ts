import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { buildSearchText } from "@/lib/text/normalize-vi";
import type { PatientInput } from "@/modules/patients/schemas";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { patients } from "@/server/db/schema";

/**
 * Writes of the patients module, always scoped to the SESSION's account (idea.md S3).
 * `search_text` is recomputed on every write so search never reads a stale value.
 */

function searchTextOf(input: PatientInput): string {
  return buildSearchText(input.fullName, input.hometown, input.phone, input.patientCode);
}

/** Adds a patient to the session's account and returns its id. */
export async function insertPatient(
  auth: AuthContext,
  input: PatientInput,
  db: DbExecutor = getDb(),
): Promise<string> {
  const [row] = await db
    .insert(patients)
    .values({ ...input, accountId: auth.account.id, searchText: searchTextOf(input) })
    .returning({ id: patients.id });
  if (!row) throw new Error("Insert returned no row");
  return row.id;
}

export type PatientUpdateResult = "updated" | "not-found" | "stale";

/**
 * Replaces the patient's fields, only if it belongs to the session's account, is not in the
 * trash, and was not edited since `version` was read (design §4). `updated_at` is compared at
 * millisecond precision: the stored value has microseconds, a JS Date only milliseconds.
 */
export async function updatePatient(
  auth: AuthContext,
  patientId: string,
  version: string,
  input: PatientInput,
  db: DbExecutor = getDb(),
): Promise<PatientUpdateResult> {
  const owned = and(
    eq(patients.id, patientId),
    eq(patients.accountId, auth.account.id),
    isNull(patients.deletedAt),
  );

  const updated = await db
    .update(patients)
    .set({ ...input, searchText: searchTextOf(input), updatedAt: sql`now()` })
    .where(
      and(owned, sql`date_trunc('milliseconds', ${patients.updatedAt}) = ${version}::timestamptz`),
    )
    .returning({ id: patients.id });
  if (updated.length > 0) return "updated";

  // Nothing written: tell "someone else's / gone" apart from "edited meanwhile".
  const [exists] = await db.select({ id: patients.id }).from(patients).where(owned).limit(1);
  return exists ? "stale" : "not-found";
}
