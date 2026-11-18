import "server-only";

import { and, asc, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";

import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION } from "@/modules/backup/constants";
import type { BackupFileInput, BackupStatus } from "@/modules/backup/types";
import type { AuthContext } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { accounts, notes, patients, todos } from "@/server/db/schema";
import { trashIsLive } from "@/server/db/trash-sql";

/**
 * Reads of the backup module, always scoped to the SESSION's account (idea.md S3). A backup
 * spans every table a doctor writes, so this DAL reads them directly (design §1).
 */

/** Live patients plus those the trash still shows: exactly what a backup contains. */
const inBackup = () => or(isNull(patients.deletedAt), trashIsLive());

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export async function getBackupStatus(
  auth: AuthContext,
  db: DbExecutor = getDb(),
): Promise<BackupStatus> {
  const id = auth.account.id;
  // One small query per table: columns stay unambiguous, and they run concurrently.
  // A timestamptz aggregate, decoded like any timestamp column (NULL stays null).
  const latest = (expression: SQL) => sql<Date | null>`${expression}`.mapWith(accounts.createdAt);
  const [[account], [patientStats], [noteStats], [todoStats]] = await Promise.all([
    db
      .select({ lastBackupAt: accounts.lastBackupAt, createdAt: accounts.createdAt })
      .from(accounts)
      .where(eq(accounts.id, id)),
    db
      .select({
        total: sql<number>`count(*) filter (where ${inBackup()})`.mapWith(Number),
        images:
          sql<number>`count(*) filter (where ${inBackup()} and ${patients.avatarPath} is not null)`.mapWith(
            Number,
          ),
        trashed: sql<number>`count(*) filter (where ${trashIsLive()})`.mapWith(Number),
        // Moving to the trash leaves updated_at alone but sets deleted_at: both are changes.
        lastChangeAt: latest(sql`max(greatest(${patients.updatedAt}, ${patients.deletedAt}))`),
      })
      .from(patients)
      .where(eq(patients.accountId, id)),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        lastChangeAt: latest(sql`max(${notes.updatedAt})`),
      })
      .from(notes)
      .innerJoin(patients, eq(patients.id, notes.patientId))
      .where(and(eq(notes.accountId, id), inBackup())),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        lastChangeAt: latest(sql`max(greatest(${todos.updatedAt}, ${todos.completedAt}))`),
      })
      .from(todos)
      .where(eq(todos.accountId, id)),
  ]);
  if (!account || !patientStats || !noteStats || !todoStats) {
    throw new Error("Account of the session not found");
  }

  const changes = [patientStats.lastChangeAt, noteStats.lastChangeAt, todoStats.lastChangeAt]
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  return {
    lastBackupAt: iso(account.lastBackupAt),
    accountCreatedAt: account.createdAt.toISOString(),
    lastChangeAt: changes.length > 0 ? new Date(Math.max(...changes)).toISOString() : null,
    counts: {
      patients: patientStats.total,
      trashed: patientStats.trashed,
      notes: noteStats.total,
      todos: todoStats.total,
      images: patientStats.images,
    },
  };
}

/**
 * Everything of the session's account, read in one REPEATABLE READ snapshot so notes always
 * match their patients (design §3). Leaves out `account_id`, `search_text`, `avatar_path`.
 */
export async function getBackupSnapshot(
  auth: AuthContext,
  appVersion: string,
): Promise<{ file: BackupFileInput; avatars: { patientId: string; path: string }[] }> {
  const id = auth.account.id;
  return getDb().transaction(
    async (tx) => {
      const [now] = await tx
        .select({ at: sql<Date>`now()`.mapWith(accounts.createdAt) })
        .from(accounts)
        .where(eq(accounts.id, id));
      if (!now) throw new Error("Account of the session not found");

      const patientRows = await tx
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
          createdAt: patients.createdAt,
          updatedAt: patients.updatedAt,
          deletedAt: patients.deletedAt,
          avatarPath: patients.avatarPath,
        })
        .from(patients)
        .where(and(eq(patients.accountId, id), inBackup()))
        .orderBy(asc(patients.createdAt), asc(patients.id));

      const noteRows = await tx
        .select({
          id: notes.id,
          patientId: notes.patientId,
          content: notes.content,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .innerJoin(patients, eq(patients.id, notes.patientId))
        .where(and(eq(notes.accountId, id), inBackup()))
        .orderBy(asc(notes.createdAt), asc(notes.id));

      const todoRows = await tx
        .select({
          id: todos.id,
          content: todos.content,
          dueDate: todos.dueDate,
          completedAt: todos.completedAt,
          createdAt: todos.createdAt,
          updatedAt: todos.updatedAt,
        })
        .from(todos)
        .where(eq(todos.accountId, id))
        .orderBy(asc(todos.createdAt), asc(todos.id));

      return {
        // Never in the file: the storage path. The route signs URLs for the browser instead.
        avatars: patientRows.flatMap((row) =>
          row.avatarPath ? [{ patientId: row.id, path: row.avatarPath }] : [],
        ),
        file: {
          manifest: {
            app: BACKUP_APP_ID,
            formatVersion: BACKUP_FORMAT_VERSION,
            appVersion,
            exportedAt: now.at.toISOString(),
            account: { username: auth.account.username },
            counts: {
              patients: patientRows.length,
              notes: noteRows.length,
              todos: todoRows.length,
              // Set by the route once the pictures are signed (only those it can serve count).
              images: 0,
            },
          },
          data: {
            patients: patientRows.map(({ avatarPath: _avatarPath, ...row }) => ({
              ...row,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              deletedAt: iso(row.deletedAt),
            })),
            notes: noteRows.map((row) => ({
              ...row,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
            })),
            todos: todoRows.map((row) => ({
              ...row,
              completedAt: iso(row.completedAt),
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
            })),
          },
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** Which of these avatar paths a patient of the session's account still uses. */
export async function usedAvatarPaths(
  auth: AuthContext,
  paths: readonly string[],
  db: DbExecutor = getDb(),
): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const rows = await db
    .select({ path: patients.avatarPath })
    .from(patients)
    .where(and(eq(patients.accountId, auth.account.id), inArray(patients.avatarPath, [...paths])));
  return new Set(rows.flatMap((row) => (row.path ? [row.path] : [])));
}
