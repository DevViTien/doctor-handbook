import Link from "next/link";

import { InitialsAvatar } from "@/components/common/initials-avatar";
import { routes } from "@/config/routes";
import type { CalendarDay } from "@/modules/patients/birth";
import { describePatientMeta } from "@/modules/patients/format";
import type { PatientListItem } from "@/modules/patients/types";

/**
 * "Có phải người này?" (spec patient-records, BR2): existing patients with the same name and no
 * contradicting birth year. A hint only: saving still adds a new patient.
 */
export function DuplicateHint({
  matches,
  today,
}: {
  matches: PatientListItem[];
  today: CalendarDay;
}) {
  if (matches.length === 0) return null;

  return (
    <section
      aria-labelledby="duplicate-hint-title"
      className="grid gap-2.5 rounded-xl border bg-muted p-3"
    >
      <h2 id="duplicate-hint-title" className="text-[0.95rem] font-bold">
        Có phải người này?
      </h2>
      <ul className="grid gap-2">
        {matches.map((patient) => {
          const meta = describePatientMeta(patient, today);
          return (
            <li
              key={patient.id}
              className="flex min-w-0 items-center gap-3 rounded-lg border bg-card py-2 pr-2 pl-3"
            >
              <InitialsAvatar name={patient.fullName} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">{patient.fullName}</span>
                {meta ? (
                  <span className="truncate text-sm text-muted-foreground">{meta}</span>
                ) : null}
              </span>
              <Link
                href={routes.doctor.patient(patient.id)}
                className="inline-flex min-h-11 shrink-0 items-center px-1.5 font-semibold text-primary underline underline-offset-3"
              >
                Mở hồ sơ
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">Không phải thì cứ bấm Lưu để thêm người mới.</p>
    </section>
  );
}
