import { ChevronRightIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { InitialsAvatar } from "@/components/common/initials-avatar";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import type { CalendarDay } from "@/modules/patients/birth";
import { describePatientMeta } from "@/modules/patients/format";
import type { PatientListItem } from "@/modules/patients/types";

/**
 * The doctor's patients (spec patient-records "Danh sách bệnh nhân"). Only name, gender, age and
 * hometown: patients and relatives may be looking at the screen (S7). Long names are truncated.
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
      {patients.map((patient) => {
        const meta = describePatientMeta(patient, today);
        return (
          <li key={patient.id}>
            <Link
              href={routes.doctor.patient(patient.id)}
              className="flex min-h-16 min-w-0 items-center gap-3 py-2.5 pr-3 pl-3.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <InitialsAvatar name={patient.fullName} />
              <span className="grid min-w-0 flex-1 gap-px">
                <span className="truncate font-semibold">{patient.fullName}</span>
                {meta ? (
                  <span className="truncate text-sm text-muted-foreground">{meta}</span>
                ) : null}
              </span>
              <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
