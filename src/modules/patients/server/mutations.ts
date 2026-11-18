import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { buildSearchText } from "@/lib/text/normalize-vi";
import type { PatientInput } from "@/modules/patients/schemas";
import type { PatientNote } from "@/modules/patients/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { notes, patients } from "@/server/db/schema";
import { trashIsExpired, trashIsLive } from "@/server/db/trash-sql";

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

type NoteRow = { id: string; created_at: Date | string; updated_at: Date | string };

/**
 * Saves one note (design §2), always scoped to the session's account AND the given patient.
 *
 * - `editing` (opened with "Sửa"): a plain UPDATE that moves `updated_at` ("Đã sửa"). It never
 *   recreates a note deleted meanwhile: that is "not found", and the text stays on the device.
 * - Otherwise an idempotent insert-or-update by the browser-made id. The INSERT only selects a
 *   patient of the session's account that is not in the trash, so nothing is ever added to
 *   another doctor's patient. ON CONFLICT only updates a note of the same account and patient,
 *   so another doctor's note id changes nothing. A re-send keeps `updated_at`: a new note stays
 *   "not edited", an edited one keeps its "Đã sửa".
 *
 * `null` when no row was written, reported by the caller as `NOT_FOUND`.
 */
export async function saveNote(
  auth: AuthContext,
  input: { patientId: string; noteId: string; content: string; editing: boolean },
  db: DbExecutor = getDb(),
): Promise<PatientNote | null> {
  const accountId = auth.account.id;
  const searchText = buildSearchText(input.content);

  const rows = input.editing
    ? await db.execute<NoteRow>(sql`
        UPDATE ${notes}
        SET content = ${input.content}, search_text = ${searchText}, updated_at = now()
        WHERE id = ${input.noteId}::uuid AND account_id = ${accountId}::uuid
          AND patient_id = ${input.patientId}::uuid
          AND EXISTS (
            SELECT 1 FROM ${patients} p
            WHERE p.id = ${input.patientId}::uuid AND p.account_id = ${accountId}::uuid
              AND p.deleted_at IS NULL
          )
        RETURNING id, created_at, updated_at
      `)
    : await db.execute<NoteRow>(sql`
        INSERT INTO ${notes} (id, patient_id, account_id, content, search_text)
        SELECT ${input.noteId}::uuid, p.id, p.account_id, ${input.content}, ${searchText}
        FROM ${patients} p
        WHERE p.id = ${input.patientId}::uuid AND p.account_id = ${accountId}::uuid
          AND p.deleted_at IS NULL
        ON CONFLICT (id) DO UPDATE
          SET content = excluded.content, search_text = excluded.search_text
          WHERE notes.account_id = ${accountId}::uuid
            AND notes.patient_id = ${input.patientId}::uuid
        RETURNING id, created_at, updated_at
      `);

  const [row] = rows;
  if (!row) return null;
  return {
    id: row.id,
    content: input.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Deletes one note of the session's account and patient. `false` when there was none. */
export async function deleteNote(
  auth: AuthContext,
  input: { patientId: string; noteId: string },
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const deleted = await db
    .delete(notes)
    .where(
      and(
        eq(notes.id, input.noteId),
        eq(notes.patientId, input.patientId),
        eq(notes.accountId, auth.account.id),
      ),
    )
    .returning({ id: notes.id });
  return deleted.length > 0;
}

/**
 * Moves a patient of the session's account to the trash (spec patient-trash). `updated_at` is
 * left alone: the list order is about edits, and a restore sets it anyway. `false` when there
 * was no such patient (another doctor's, unknown, or already in the trash).
 */
export async function moveToTrash(
  auth: AuthContext,
  patientId: string,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const moved = await db
    .update(patients)
    .set({ deletedAt: sql`now()`, updatedAt: sql`${patients.updatedAt}` })
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.accountId, auth.account.id),
        isNull(patients.deletedAt),
      ),
    )
    .returning({ id: patients.id });
  return moved.length > 0;
}

/**
 * Brings a patient back from the trash, on top of the list (`updated_at = now()`), if it is
 * still within the 30 days. Notes were never touched, so they come back as they were.
 */
export async function restoreFromTrash(
  auth: AuthContext,
  patientId: string,
  db: DbExecutor = getDb(),
): Promise<boolean> {
  const restored = await db
    .update(patients)
    .set({ deletedAt: null, updatedAt: sql`now()` })
    .where(and(eq(patients.id, patientId), eq(patients.accountId, auth.account.id), trashIsLive()))
    .returning({ id: patients.id });
  return restored.length > 0;
}

/**
 * Deletes a patient for good, with its notes (`ON DELETE CASCADE`). Only a patient already in
 * the trash: a live patient can never be deleted in one step.
 */
export async function deletePermanently(
  auth: AuthContext,
  patientId: string,
  db: DbExecutor = getDb(),
): Promise<{ avatarPath: string | null } | null> {
  const deleted = await db
    .delete(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.accountId, auth.account.id),
        isNotNull(patients.deletedAt),
      ),
    )
    .returning({ avatarPath: patients.avatarPath });
  return deleted[0] ?? null;
}

/**
 * Daily maintenance (cron, not Admin code): deletes every patient that has been in the trash for
 * 30 days or more, with its notes, for all accounts. Reads no content; returns only a count.
 */
export async function purgeExpiredTrash(
  db: DbExecutor = getDb(),
): Promise<{ purged: number; avatarPaths: string[] }> {
  const purged = await db
    .delete(patients)
    .where(and(isNotNull(patients.deletedAt), trashIsExpired()))
    .returning({ avatarPath: patients.avatarPath });
  return {
    purged: purged.length,
    avatarPaths: purged.flatMap((row) => (row.avatarPath ? [row.avatarPath] : [])),
  };
}

/**
 * Sets the avatar of a kept patient of the session's account (spec patient-avatars, design §3)
 * and returns the previous path, to delete. `undefined` when there is no such patient. A path
 * another patient already uses is refused the same way: one object, one patient.
 * `updated_at` moves: a new picture is a change (the backup reminder counts it, the list puts the
 * patient on top), like any edit.
 */
export async function setAvatar(
  auth: AuthContext,
  patientId: string,
  avatarPath: string | null,
  db: DbExecutor = getDb(),
): Promise<{ previous: string | null } | undefined> {
  const rows = await db.execute<{ previous: string | null }>(sql`
    UPDATE ${patients} AS p SET avatar_path = ${avatarPath}, updated_at = now()
    FROM (
      SELECT id, avatar_path AS previous FROM ${patients}
      WHERE id = ${patientId}::uuid AND account_id = ${auth.account.id}::uuid
        AND deleted_at IS NULL
      FOR UPDATE
    ) AS old
    WHERE p.id = old.id
      AND (${avatarPath}::text IS NULL OR NOT EXISTS (
        SELECT 1 FROM ${patients} WHERE avatar_path = ${avatarPath} AND id <> ${patientId}::uuid
      ))
    RETURNING old.previous
  `);
  const [row] = rows;
  return row ? { previous: row.previous } : undefined;
}
