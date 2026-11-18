import "server-only";

import { randomUUID } from "node:crypto";

import { count, eq, sql } from "drizzle-orm";

import { TRASH_RETENTION_DAYS } from "@/config/retention";
import { AppError } from "@/lib/errors";
import { buildSearchText } from "@/lib/text/normalize-vi";
import { BACKUP_MESSAGES } from "@/modules/backup/constants";
import type { BackupFile, ImportResult } from "@/modules/backup/types";
import type { AuthContext } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { accounts, notes, patients, todos } from "@/server/db/schema";

/** Writes of the backup module, always scoped to the SESSION's account (idea.md S3). */

/** Rows per INSERT: well under PostgreSQL's 65,535 parameters for every table. */
const BATCH = 500;

function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < rows.length; start += BATCH)
    out.push(rows.slice(start, start + BATCH));
  return out;
}

/** "Lần sao lưu gần nhất" = now, by the database clock (never a time sent by the browser). */
export async function recordBackup(auth: AuthContext): Promise<void> {
  await getDb()
    .update(accounts)
    .set({ lastBackupAt: sql`now()` })
    .where(eq(accounts.id, auth.account.id));
}

/**
 * Replace-all import (spec data-import, design §4): in ONE transaction, deletes every patient
 * (notes cascade) and todo of the session's account, then writes the file's rows under NEW ids.
 * New ids: a file from another account, or from this one, may hold ids still used elsewhere on
 * this server; keeping them would fail, and the failure would reveal that they exist.
 * `search_text` is recomputed, never read from the file. Any error rolls everything back.
 */
export async function replaceAllData(
  auth: AuthContext,
  file: BackupFile,
  options: { replacingExisting: boolean },
): Promise<ImportResult> {
  const accountId = auth.account.id;
  const { manifest } = file;
  // Patients the trash would no longer show (deleted 30+ days ago): not brought back to life.
  const expiredBefore = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const kept = file.data.patients.filter(
    (patient) => patient.deletedAt === null || Date.parse(patient.deletedAt) > expiredBefore,
  );
  const keptIds = new Set(kept.map((patient) => patient.id));
  const data = {
    patients: kept,
    notes: file.data.notes.filter((note) => keptIds.has(note.patientId)),
    todos: file.data.todos,
  };

  return getDb().transaction(async (tx) => {
    // One import at a time per account: under READ COMMITTED, a second import's DELETE would
    // not see the first one's uncommitted rows, and both files would end up merged.
    await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");

    // The browser only skips the confirmation and the automatic backup when it saw an empty
    // account. If data appeared since (another device, a stale page), refuse: never delete
    // what the doctor was not warned about.
    if (!options.replacingExisting) {
      const [patientCount] = await tx
        .select({ n: count() })
        .from(patients)
        .where(eq(patients.accountId, accountId));
      const [todoCount] = await tx
        .select({ n: count() })
        .from(todos)
        .where(eq(todos.accountId, accountId));
      if ((patientCount?.n ?? 0) + (todoCount?.n ?? 0) > 0) {
        throw new AppError("CONFLICT", BACKUP_MESSAGES.importNotEmpty);
      }
    }

    await tx.delete(todos).where(eq(todos.accountId, accountId));
    await tx.delete(patients).where(eq(patients.accountId, accountId));

    const patientIds = new Map(data.patients.map((patient) => [patient.id, randomUUID()]));

    for (const batch of chunks(data.patients)) {
      await tx.insert(patients).values(
        batch.map((patient) => ({
          id: patientIds.get(patient.id),
          accountId,
          fullName: patient.fullName,
          birthYear: patient.birthYear,
          birthDate: patient.birthDate,
          gender: patient.gender,
          hometown: patient.hometown,
          phone: patient.phone,
          patientCode: patient.patientCode,
          summary: patient.summary,
          searchText: buildSearchText(
            patient.fullName,
            patient.hometown,
            patient.phone,
            patient.patientCode,
          ),
          createdAt: new Date(patient.createdAt),
          updatedAt: new Date(patient.updatedAt),
          deletedAt: patient.deletedAt ? new Date(patient.deletedAt) : null,
        })),
      );
    }

    for (const batch of chunks(data.notes)) {
      await tx.insert(notes).values(
        batch.map((note) => {
          const patientId = patientIds.get(note.patientId);
          // The schema already guarantees it; this keeps a broken invariant from writing junk.
          if (!patientId) throw new Error("Note without its patient");
          return {
            id: randomUUID(),
            patientId,
            accountId,
            content: note.content,
            searchText: buildSearchText(note.content),
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt),
          };
        }),
      );
    }

    for (const batch of chunks(data.todos)) {
      await tx.insert(todos).values(
        batch.map((todo) => ({
          id: randomUUID(),
          accountId,
          content: todo.content,
          dueDate: todo.dueDate,
          completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
          createdAt: new Date(todo.createdAt),
          updatedAt: new Date(todo.updatedAt),
        })),
      );
    }

    // The doctor holds this file: the data now is a backup as old as the file. GREATEST skips
    // NULL, and a file dated in the future counts as now.
    await tx
      .update(accounts)
      .set({
        lastBackupAt: sql`greatest(${accounts.lastBackupAt}, least(${manifest.exportedAt}::timestamptz, now()))`,
      })
      .where(eq(accounts.id, accountId));

    return { patients: data.patients.length, notes: data.notes.length, todos: data.todos.length };
  });
}
