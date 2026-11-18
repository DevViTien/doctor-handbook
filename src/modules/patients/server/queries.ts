import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import type {
  PatientDetail,
  PatientListItem,
  PatientNote,
  TrashedPatient,
} from "@/modules/patients/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { notes, patients } from "@/server/db/schema";
import { trashIsLive } from "@/server/db/trash-sql";

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

/**
 * Notes of one patient of the session's account, newest first (spec patient-notes). Scoped by
 * the denormalized `notes.account_id`, which a composite foreign key keeps equal to the
 * patient's owner. `patientId` MUST already be a valid UUID.
 */
export async function listNotes(
  auth: AuthContext,
  patientId: string,
  db: DbExecutor = getDb(),
): Promise<PatientNote[]> {
  const rows = await db
    .select({
      id: notes.id,
      content: notes.content,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(and(eq(notes.patientId, patientId), eq(notes.accountId, auth.account.id)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * The session's trash, most recently deleted first (spec patient-trash "Trang thùng rác").
 * Patients past the 30 days are never listed, even before the daily purge removed them.
 */
export async function listTrash(
  auth: AuthContext,
  db: DbExecutor = getDb(),
): Promise<TrashedPatient[]> {
  const rows = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      birthYear: patients.birthYear,
      birthDate: patients.birthDate,
      gender: patients.gender,
      hometown: patients.hometown,
      deletedAt: patients.deletedAt,
    })
    .from(patients)
    .where(and(eq(patients.accountId, auth.account.id), trashIsLive()))
    .orderBy(desc(patients.deletedAt), desc(patients.id));
  return rows.flatMap(({ deletedAt, ...patient }) =>
    deletedAt ? [{ ...patient, deletedAt: deletedAt.toISOString() }] : [],
  );
}

/** How many patients the session's trash holds (the Settings row). */
export async function countTrash(auth: AuthContext, db: DbExecutor = getDb()): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(patients)
    .where(and(eq(patients.accountId, auth.account.id), trashIsLive()));
  return row?.value ?? 0;
}
