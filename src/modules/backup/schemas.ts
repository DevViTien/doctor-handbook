import { z } from "zod";

import { GENDERS } from "@/lib/enums";
import { BACKUP_APP_ID, BACKUP_FORMAT_VERSION, BACKUP_LIMITS } from "@/modules/backup/constants";
import { NOTE_LIMITS, PATIENT_LIMITS, PHONE_PATTERN } from "@/modules/patients/constants";

/**
 * The backup file, format version 1 (design §2). One schema for both sides: the browser checks a
 * file before showing its summary, and the server checks the import again before writing (it never
 * trusts the browser). Rules mirror the forms, so an import cannot store what a doctor could not
 * have typed. Unknown keys (e.g. an `accountId` added by hand) are dropped.
 */

/** NFC + trim, like every form field (see the patients schemas). */
const text = z.string().transform((value) => value.normalize("NFC").trim());

const requiredText = (max: number) => text.pipe(z.string().min(1).max(max));

/** Optional text: `null`, or a string that may be empty (stored as `null`). */
const optionalText = (max: number) =>
  text
    .pipe(z.string().max(max))
    .transform((value) => value || null)
    .nullable();

const instant = z.iso.datetime({ offset: true });

/** "yyyy-mm-dd" that exists in the calendar (no 31/02). */
const calendarDay = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
});

const patientSchema = z
  .object({
    id: z.uuid(),
    fullName: requiredText(PATIENT_LIMITS.fullName),
    // No "not in the future" rule: it would depend on the device clock (a phone set a few days
    // back would refuse its own server's data). The forms enforce it when typing.
    birthYear: z.int().min(PATIENT_LIMITS.minBirthYear).max(2200).nullable(),
    birthDate: calendarDay.nullable(),
    gender: z.enum(GENDERS).nullable(),
    hometown: optionalText(PATIENT_LIMITS.hometown),
    phone: optionalText(PATIENT_LIMITS.phone).refine(
      (value) => value === null || PHONE_PATTERN.test(value),
    ),
    patientCode: optionalText(PATIENT_LIMITS.patientCode),
    summary: optionalText(PATIENT_LIMITS.summary),
    createdAt: instant,
    updatedAt: instant,
    deletedAt: instant.nullable(),
  })
  .superRefine((patient, ctx) => {
    // A full date always comes with its own year (parseBirthInput).
    if (patient.birthDate !== null && patient.birthYear !== Number(patient.birthDate.slice(0, 4))) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Ngày sinh lệch năm sinh." });
    }
  });

const noteSchema = z.object({
  id: z.uuid(),
  patientId: z.uuid(),
  content: requiredText(NOTE_LIMITS.content),
  createdAt: instant,
  updatedAt: instant,
});

const todoSchema = z.object({
  id: z.uuid(),
  content: requiredText(BACKUP_LIMITS.todoContent),
  dueDate: calendarDay.nullable(),
  completedAt: instant.nullable(),
  createdAt: instant,
  updatedAt: instant,
});

const countSchema = z.int().min(0);

/** Just enough of the manifest to know whether this app can read the rest. */
export const backupHeaderSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.int().min(1),
});

export const backupManifestSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  appVersion: z.string().max(50),
  exportedAt: instant,
  account: z.object({ username: z.string().min(1).max(100) }),
  counts: z.object({ patients: countSchema, notes: countSchema, todos: countSchema }),
});

export const backupDataSchema = z.object({
  patients: z.array(patientSchema).max(BACKUP_LIMITS.patients),
  notes: z.array(noteSchema).max(BACKUP_LIMITS.notes),
  todos: z.array(todoSchema).max(BACKUP_LIMITS.todos),
});

function hasDuplicates(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

/** A whole file of the current version, with the checks that span several rows. */
export const backupFileSchema = z
  .object({ manifest: backupManifestSchema, data: backupDataSchema })
  .superRefine(({ manifest, data }, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const patientIds = data.patients.map((patient) => patient.id);
    if (hasDuplicates(patientIds)) issue("Duplicate patient id.");
    if (hasDuplicates(data.notes.map((note) => note.id))) issue("Duplicate note id.");
    if (hasDuplicates(data.todos.map((todo) => todo.id))) issue("Duplicate todo id.");

    const known = new Set(patientIds);
    if (data.notes.some((note) => !known.has(note.patientId))) issue("Note without its patient.");

    const { counts } = manifest;
    if (
      counts.patients !== data.patients.length ||
      counts.notes !== data.notes.length ||
      counts.todos !== data.todos.length
    ) {
      issue("Counts do not match the data.");
    }
  });
