import { z } from "zod";

import { GENDERS } from "@/lib/enums";
import { parseBirthInput, todayInVietnam } from "@/modules/patients/birth";
import {
  NOTE_LIMITS,
  NOTE_MESSAGES,
  PATIENT_LIMITS,
  PATIENT_MESSAGES,
  PHONE_PATTERN,
} from "@/modules/patients/constants";

/**
 * Patient form fields (spec patient-records "Thêm bệnh nhân", "Giới hạn các ô thông tin").
 * Field names are deliberately unusual (`patientFullName`, not `name`) so browsers do not offer
 * to autofill the doctor's OWN name, phone or address into a patient record (design, Risks).
 */
export const PATIENT_FIELD_NAMES = {
  fullName: "patientFullName",
  birth: "patientBirth",
  gender: "patientGender",
  hometown: "patientHometown",
  phone: "patientPhone",
  patientCode: "patientCode",
  summary: "patientSummary",
} as const;

/**
 * Missing → "", then NFC-normalized and trimmed. FormData gives strings; a missing field must not
 * crash. NFC first: some Vietnamese keyboards type decomposed letters (2–3 code units each), which
 * would make the length limits reject text that looks much shorter, and break name comparisons.
 */
const text = z
  .string()
  .optional()
  .transform((value) => (value ?? "").normalize("NFC").trim());

/** Optional text: empty becomes `null` ("chưa có"). */
const optionalText = (max: number, tooLong: string) =>
  text.pipe(z.string().max(max, tooLong)).transform((value) => value || null);

const patientFields = {
  [PATIENT_FIELD_NAMES.fullName]: text.pipe(
    z
      .string()
      .min(1, PATIENT_MESSAGES.fullNameRequired)
      .max(PATIENT_LIMITS.fullName, PATIENT_MESSAGES.fullNameTooLong),
  ),
  [PATIENT_FIELD_NAMES.birth]: text.transform((value, ctx) => {
    const parsed = parseBirthInput(value, todayInVietnam());
    if (parsed.kind === "error") {
      ctx.addIssue({ code: "custom", message: parsed.message });
      return z.NEVER;
    }
    return parsed.kind === "ok"
      ? { birthYear: parsed.birthYear, birthDate: parsed.birthDate }
      : { birthYear: null, birthDate: null };
  }),
  [PATIENT_FIELD_NAMES.gender]: text
    .pipe(z.enum(["", ...GENDERS], { error: PATIENT_MESSAGES.genderInvalid }))
    .transform((value) => (value === "" ? null : value)),
  [PATIENT_FIELD_NAMES.hometown]: optionalText(
    PATIENT_LIMITS.hometown,
    PATIENT_MESSAGES.hometownTooLong,
  ),
  [PATIENT_FIELD_NAMES.phone]: text
    .pipe(
      z
        .string()
        .max(PATIENT_LIMITS.phone, PATIENT_MESSAGES.phoneTooLong)
        .refine(
          (value) => value === "" || PHONE_PATTERN.test(value),
          PATIENT_MESSAGES.phoneInvalid,
        ),
    )
    .transform((value) => value || null),
  [PATIENT_FIELD_NAMES.patientCode]: optionalText(
    PATIENT_LIMITS.patientCode,
    PATIENT_MESSAGES.patientCodeTooLong,
  ),
  [PATIENT_FIELD_NAMES.summary]: optionalText(
    PATIENT_LIMITS.summary,
    PATIENT_MESSAGES.summaryTooLong,
  ),
};

/** The add form. Output is mapped to `PatientInput` with `toPatientInput`. */
export const patientFormSchema = z.object(patientFields);

/** The edit form: the same fields, plus which patient and which version was loaded. */
export const updatePatientFormSchema = z.object({
  ...patientFields,
  patientId: z.uuid({ error: PATIENT_MESSAGES.notFound }),
  version: z.iso.datetime({ offset: true, error: PATIENT_MESSAGES.changedElsewhere }),
});

/** What the DAL writes. */
export type PatientInput = {
  fullName: string;
  birthYear: number | null;
  birthDate: string | null;
  gender: (typeof GENDERS)[number] | null;
  hometown: string | null;
  phone: string | null;
  patientCode: string | null;
  summary: string | null;
};

export function toPatientInput(parsed: z.output<typeof patientFormSchema>): PatientInput {
  const birth = parsed[PATIENT_FIELD_NAMES.birth];
  return {
    fullName: parsed[PATIENT_FIELD_NAMES.fullName],
    birthYear: birth.birthYear,
    birthDate: birth.birthDate,
    gender: parsed[PATIENT_FIELD_NAMES.gender],
    hometown: parsed[PATIENT_FIELD_NAMES.hometown],
    phone: parsed[PATIENT_FIELD_NAMES.phone],
    patientCode: parsed[PATIENT_FIELD_NAMES.patientCode],
    summary: parsed[PATIENT_FIELD_NAMES.summary],
  };
}

const noteContent = text.pipe(
  z.string().min(1, NOTE_MESSAGES.empty).max(NOTE_LIMITS.content, NOTE_MESSAGES.tooLong),
);

/**
 * Autosave of one note (spec patient-notes, design §2). The browser makes `noteId` up front, so
 * re-sending is an idempotent "insert or update". `editing` is true when the composer was opened
 * with "Sửa" on an existing note: only then is the note shown as edited.
 */
export const saveNoteSchema = z.object({
  patientId: z.uuid(),
  noteId: z.uuid(),
  content: noteContent,
  editing: z.boolean(),
});

export const deleteNoteSchema = z.object({
  patientId: z.uuid(),
  noteId: z.uuid(),
});

/** Patient id taken from a URL: anything that is not a UUID is simply "not found". */
export const patientIdSchema = z.uuid();
