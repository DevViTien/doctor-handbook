import { UsersIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PersonRow } from "@/components/common/person-row";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import type { CalendarDay } from "@/modules/patients/birth";
import { describePatientMeta } from "@/modules/patients/format";
import type { PatientListItem } from "@/modules/patients/types";

/**
 * The doctor's patients (spec patient-records "Danh sách bệnh nhân"). Only name, gender, age and
 * hometown: patients and relatives may be looking at the screen (S7). Long names are truncated.
 * With patients, the list page renders the searchable list of module `search` instead; this
 * component then only provides the empty notebook state.
 */
export function PatientList({
  patients,
  today,
}: {
  patients: PatientListItem[];
  today: CalendarDay;
}) {
  if (patients.length === 0) {
    return (
      <EmptyState
        className="rounded-2xl border bg-card"
        icon={UsersIcon}
        title="Sổ chưa có bệnh nhân nào"
        description="Chỉ cần họ tên là thêm được. Năm sinh, quê, tóm tắt… bổ sung sau cũng được."
        action={
          <Button asChild className="h-12 px-5 text-base font-semibold">
            <Link href={routes.doctor.newPatient}>Thêm bệnh nhân</Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {patients.map((patient) => (
        <li key={patient.id}>
          <PersonRow
            href={routes.doctor.patient(patient.id)}
            name={patient.fullName}
            meta={describePatientMeta(patient, today)}
          />
        </li>
      ))}
    </ul>
  );
}
