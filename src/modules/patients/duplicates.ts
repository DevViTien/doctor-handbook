import { normalizeVi } from "@/lib/text/normalize-vi";
import { PATIENT_LIMITS } from "@/modules/patients/constants";
import type { PatientListItem } from "@/modules/patients/types";

/**
 * "Có phải người này?" on the add form (spec patient-records, BR2). Same name once accents,
 * case and extra spaces are ignored, and birth years that do not contradict each other (equal,
 * or at least one unknown). A hint only: it never blocks saving.
 */
export function findPossibleDuplicates(
  candidates: readonly PatientListItem[],
  typed: { fullName: string; birthYear: number | null },
): PatientListItem[] {
  const name = normalizeVi(typed.fullName);
  if (!name) return [];

  return candidates
    .filter(
      (patient) =>
        normalizeVi(patient.fullName) === name &&
        (typed.birthYear === null ||
          patient.birthYear === null ||
          patient.birthYear === typed.birthYear),
    )
    .slice(0, PATIENT_LIMITS.duplicateSuggestions);
}
