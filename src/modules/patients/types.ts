import type { Gender } from "@/lib/enums";

/** Year of birth, plus the full date (`YYYY-MM-DD`) when known. */
export type Birth = {
  birthYear: number | null;
  birthDate: string | null;
};

/**
 * One row of the patient list (and of the duplicate-name candidates). Deliberately WITHOUT
 * summary, phone and patient code: the list never shows them (idea.md S7).
 */
export type PatientListItem = Birth & {
  id: string;
  fullName: string;
  gender: Gender | null;
  hometown: string | null;
};

/** Everything the detail and edit pages show. `version` guards against overwriting (design §4). */
export type PatientDetail = PatientListItem & {
  phone: string | null;
  patientCode: string | null;
  summary: string | null;
  /** `updated_at` as an ISO string, millisecond precision. */
  version: string;
};

/** A patient in the trash, as the trash page shows it (spec patient-trash). */
export type TrashedPatient = PatientListItem & {
  /** When it was moved to the trash, ISO string. */
  deletedAt: string;
};

/** One note of a patient (spec patient-notes). Dates as ISO strings: they cross to the client. */
export type PatientNote = {
  id: string;
  content: string;
  createdAt: string;
  /** Equals `createdAt` until the note is edited with "Sửa" (design §2). */
  updatedAt: string;
};

/** Values of the add/edit form, as typed (strings), kept when a save fails. */
export type PatientFormValues = {
  fullName: string;
  birth: string;
  gender: string;
  hometown: string;
  phone: string;
  patientCode: string;
  summary: string;
};
