import { type CalendarDay, describeBirthDetail, describeListAge } from "@/modules/patients/birth";
import { GENDER_LABELS } from "@/modules/patients/constants";
import type { PatientListItem } from "@/modules/patients/types";

const SEPARATOR = " · ";

/** List row and duplicate hint: `"Nam · 47 tuổi · Nghệ An"`, skipping what is unknown. */
export function describePatientMeta(patient: PatientListItem, today: CalendarDay): string {
  return [
    patient.gender ? GENDER_LABELS[patient.gender] : null,
    describeListAge(patient, today),
    patient.hometown,
  ]
    .filter(Boolean)
    .join(SEPARATOR);
}

/** Detail header: `"Nam · 47 tuổi (1979) · Nghệ An"`. */
export function describePatientDetailMeta(patient: PatientListItem, today: CalendarDay): string {
  return [
    patient.gender ? GENDER_LABELS[patient.gender] : null,
    describeBirthDetail(patient, today),
    patient.hometown,
  ]
    .filter(Boolean)
    .join(SEPARATOR);
}

/**
 * `tel:` target: digits only, keeping an international `+` even inside leading brackets
 * (`"0912 345 678"` → `"tel:0912345678"`, `"(+84) 912…"` → `"tel:+84912…"`).
 */
export function telHref(phone: string): string {
  const international = phone.replace(/^[\s(]+/, "").startsWith("+");
  return `tel:${international ? "+" : ""}${phone.replace(/\D/g, "")}`;
}
