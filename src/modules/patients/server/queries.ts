import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import type { PatientDetail, PatientListItem } from "@/modules/patients/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { patients } from "@/server/db/schema";

/**
 * Reads of the patients module. Every query is scoped to the SESSION's account and skips
 * patients in the trash (idea.md S3, BR5). Never accept an account id from the client.
 */

const ownedAndKept = (auth: AuthContext) =>
  and(eq(patients.accountId, auth.account.id), isNull(patients.deletedAt));

/**
 * The doctor's patients, most recently added or edited first (spec "Danh sách bệnh nhân").
 * Selects no summary, phone or patient code: the list must never show them (S7).
 */
export async function listPatients(
  auth: AuthContext,
  db: DbExecutor = getDb(),
): Promise<PatientListItem[]> {
  return db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      birthYear: patients.birthYear,
      birthDate: patients.birthDate,
      gender: patients.gender,
      hometown: patients.hometown,
    })
    .from(patients)
    .where(ownedAndKept(auth))
    .orderBy(desc(patients.updatedAt), desc(patients.id));
}

/**
 * One patient of the session's account, or `null` when the id belongs to another doctor, is in
 * the trash or does not exist: callers cannot tell these apart, and neither can the user.
 * `patientId` MUST already be a valid UUID (see `patientIdSchema`).
 */
export async function getPatient(
  auth: AuthContext,
  patientId: string,
  db: DbExecutor = getDb(),
): Promise<PatientDetail | null> {
  const [row] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      birthYear: patients.birthYear,
      birthDate: patients.birthDate,
      gender: patients.gender,
      hometown: patients.hometown,
      phone: patients.phone,
      patientCode: patients.patientCode,
      summary: patients.summary,
      updatedAt: patients.updatedAt,
    })
    .from(patients)
    .where(and(eq(patients.id, patientId), ownedAndKept(auth)))
    .limit(1);

  if (!row) return null;
  const { updatedAt, ...patient } = row;
  // A JS Date keeps milliseconds; the update compares at that precision (design §4).
  return { ...patient, version: updatedAt.toISOString() };
}
