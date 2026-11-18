"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors";
import { NOTE_MESSAGES, PATIENT_MESSAGES } from "@/modules/patients/constants";
import {
  deleteNoteSchema,
  patientFormSchema,
  patientIdInputSchema,
  prepareAvatarUploadSchema,
  saveNoteSchema,
  setAvatarSchema,
  toPatientInput,
  updatePatientFormSchema,
} from "@/modules/patients/schemas";
import {
  deleteNote,
  deletePermanently,
  insertPatient,
  moveToTrash,
  restoreFromTrash,
  saveNote,
  setAvatar,
  updatePatient,
} from "@/modules/patients/server/mutations";
import { avatarUrlFor, getPatient } from "@/modules/patients/server/queries";
import type { PatientNote } from "@/modules/patients/types";
import { createAction, createFormAction } from "@/server/actions/create-action";
import {
  createSignedUploadUrl,
  isAvatarPathOf,
  newAvatarObjectPath,
  removeAvatarsQuietly,
  STORAGE_BUCKETS,
} from "@/server/storage/objects";

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

/** Pages showing a patient, its absence, or the trash count. */
function revalidateTrashViews(patientId: string) {
  revalidatePath(routes.doctor.patients);
  revalidatePath(routes.doctor.patient(patientId));
  revalidatePath(routes.doctor.settings);
  revalidatePath(routes.doctor.trash);
}

/**
 * "Chuyển vào thùng rác" (spec patient-trash): no confirmation, it can be undone. No
 * `revalidatePath`: it would make Next re-render the current page, the patient's own page, into
 * the response, flashing "Không tìm thấy bệnh nhân" before the client moves to the list. Every
 * page that shows it is dynamic and refetched on navigation anyway.
 */
export const moveToTrashAction = createAction(
  { name: "patients.trash.move", schema: patientIdInputSchema, access: "doctor" },
  async ({ patientId }, { auth }): Promise<{ moved: true }> => {
    if (!(await moveToTrash(auth, patientId))) {
      throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    }
    return { moved: true };
  },
);

/** "Hoàn tác" and "Khôi phục": back on top of the list, within the 30 days. */
export const restoreFromTrashAction = createAction(
  { name: "patients.trash.restore", schema: patientIdInputSchema, access: "doctor" },
  async ({ patientId }, { auth }): Promise<{ restored: true }> => {
    if (!(await restoreFromTrash(auth, patientId))) {
      throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    }
    revalidateTrashViews(patientId);
    return { restored: true };
  },
);

/** "Xoá vĩnh viễn", after the confirmation dialog: only a patient already in the trash. */
export const deletePermanentlyAction = createAction(
  { name: "patients.trash.delete", schema: patientIdInputSchema, access: "doctor" },
  async ({ patientId }, { auth }): Promise<{ deleted: true }> => {
    const deleted = await deletePermanently(auth, patientId);
    if (!deleted) throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    // The picture goes with the patient (spec patient-avatars "Ảnh bị xoá cùng bệnh nhân").
    await removeAvatarsQuietly([deleted.avatarPath]);
    revalidateTrashViews(patientId);
    return { deleted: true };
  },
);

/**
 * Step 1 of setting an avatar (design §3): a signed URL the browser uploads the shrunk picture
 * to, directly (it never passes through a Vercel Function). Only for a kept patient of the
 * session's account; the path is a fresh random name under that account.
 */
export const prepareAvatarUploadAction = createAction(
  { name: "patients.avatar.prepare", schema: prepareAvatarUploadSchema, access: "doctor" },
  async ({ patientId, format }, { auth }): Promise<{ uploadUrl: string; path: string }> => {
    if (!(await getPatient(auth, patientId))) {
      throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    }
    const path = newAvatarObjectPath(auth.account.id, format);
    const { signedUrl } = await createSignedUploadUrl(STORAGE_BUCKETS.avatars, path);
    return { uploadUrl: signedUrl, path };
  },
);

/** Step 2: attach the uploaded picture; the previous one is deleted from storage. */
export const setAvatarAction = createAction(
  { name: "patients.avatar.set", schema: setAvatarSchema, access: "doctor" },
  async ({ patientId, path }, { auth }): Promise<{ avatarUrl: string }> => {
    // Only a path under THIS account: never another doctor's picture (spec "Gắn ảnh của tài
    // khoản khác").
    if (!isAvatarPathOf(auth.account.id, path)) throw new AppError("VALIDATION_FAILED");
    const result = await setAvatar(auth, patientId, path);
    if (!result) throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    if (result.previous !== path) await removeAvatarsQuietly([result.previous]);
    revalidatePath(routes.doctor.patients);
    return { avatarUrl: avatarUrlFor(patientId, path) ?? "" };
  },
);

/** "Xoá ảnh", after the confirmation: back to initials, the object is deleted. */
export const removeAvatarAction = createAction(
  { name: "patients.avatar.remove", schema: patientIdInputSchema, access: "doctor" },
  async ({ patientId }, { auth }): Promise<{ removed: true }> => {
    const result = await setAvatar(auth, patientId, null);
    if (!result) throw new AppError("NOT_FOUND", PATIENT_MESSAGES.notFound);
    await removeAvatarsQuietly([result.previous]);
    revalidatePath(routes.doctor.patients);
    return { removed: true };
  },
);
