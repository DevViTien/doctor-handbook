"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors";
import { NOTE_MESSAGES, PATIENT_MESSAGES } from "@/modules/patients/constants";
import {
  deleteNoteSchema,
  patientFormSchema,
  saveNoteSchema,
  toPatientInput,
  updatePatientFormSchema,
} from "@/modules/patients/schemas";
import {
  deleteNote,
  insertPatient,
  saveNote,
  updatePatient,
} from "@/modules/patients/server/mutations";
import type { PatientNote } from "@/modules/patients/types";
import { createAction, createFormAction } from "@/server/actions/create-action";

/**
 * Patient form actions (spec patient-records). Doctors only; the account always comes from the
 * session. They return the patient id instead of redirecting: the form navigates itself, so a
 * network failure can be caught on the client without losing what was typed (design §5).
 * `createAction` logs only the action name on unexpected errors, never the input.
 */

export type SavedPatient = { id: string };

export const createPatientFormAction = createFormAction(
  { name: "patients.create", schema: patientFormSchema, access: "doctor" },
  async (input, { auth }): Promise<SavedPatient> => {
    const id = await insertPatient(auth, toPatientInput(input));
    revalidatePath(routes.doctor.patients);
    return { id };
  },
);

export const updatePatientFormAction = createFormAction(
  { name: "patients.update", schema: updatePatientFormSchema, access: "doctor" },
  async (input, { auth }): Promise<SavedPatient> => {
    const result = await updatePatient(auth, input.patientId, input.version, toPatientInput(input));
    if (result === "not-found") throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    if (result === "stale") throw new AppError("CONFLICT", PATIENT_MESSAGES.changedElsewhere);

    revalidatePath(routes.doctor.patients);
    revalidatePath(routes.doctor.patient(input.patientId));
    return { id: input.patientId };
  },
);

/**
 * Autosave of one note (spec patient-notes, design §2): idempotent insert-or-update by the
 * browser-made `noteId`. No `revalidatePath`: it runs about once a second while typing, and the
 * notes section updates itself from the returned note.
 */
export const saveNoteAction = createAction(
  { name: "patients.notes.save", schema: saveNoteSchema, access: "doctor" },
  async (input, { auth }): Promise<PatientNote> => {
    const note = await saveNote(auth, input);
    if (!note) throw new AppError("NOT_FOUND", NOTE_MESSAGES.notFound);
    return note;
  },
);

/** Permanently deletes one note, after the confirmation dialog (spec "Xoá ghi chú"). */
export const deleteNoteAction = createAction(
  { name: "patients.notes.delete", schema: deleteNoteSchema, access: "doctor" },
  async (input, { auth }): Promise<{ deleted: true }> => {
    if (!(await deleteNote(auth, input))) {
      throw new AppError("NOT_FOUND", NOTE_MESSAGES.notFound);
    }
    return { deleted: true };
  },
);
