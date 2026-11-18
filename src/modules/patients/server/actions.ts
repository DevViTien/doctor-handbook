"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import { AppError } from "@/lib/errors";
import { PATIENT_MESSAGES } from "@/modules/patients/constants";
import {
  patientFormSchema,
  toPatientInput,
  updatePatientFormSchema,
} from "@/modules/patients/schemas";
import { insertPatient, updatePatient } from "@/modules/patients/server/mutations";
import { createFormAction } from "@/server/actions/create-action";

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
