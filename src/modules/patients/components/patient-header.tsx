import { IdCardIcon, PhoneIcon } from "lucide-react";

import { InitialsAvatar } from "@/components/common/initials-avatar";
import type { CalendarDay } from "@/modules/patients/birth";
import { describePatientDetailMeta, telHref } from "@/modules/patients/format";
import type { PatientDetail } from "@/modules/patients/types";

/**
 * Top of the patient detail page: name (the page's `h1`), "Nam · 47 tuổi (1979) · Nghệ An", then
 * the phone (tap to call) and the clinic's patient code. What is unknown is not shown.
 */
export function PatientHeader({ patient, today }: { patient: PatientDetail; today: CalendarDay }) {
  const meta = describePatientDetailMeta(patient, today);

  return (
    <>
      <div className="flex min-w-0 items-center gap-3.5 pt-2 pb-4">
        <InitialsAvatar name={patient.fullName} className="size-14 text-lg" />
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-[1.4rem] leading-tight font-bold tracking-tight break-words">
            {patient.fullName}
          </h1>
          {meta ? <p className="text-[0.95rem] text-muted-foreground">{meta}</p> : null}
        </div>
      </div>

      {patient.phone || patient.patientCode ? (
        <ul className="mb-4 divide-y rounded-2xl border bg-card">
          {patient.phone ? (
            <li className="flex min-h-14 items-center gap-3 px-3.5 py-1.5">
              <PhoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="grid min-w-0">
                <span className="text-[0.8rem] text-muted-foreground">Số điện thoại</span>
                <a
                  href={telHref(patient.phone)}
                  className="inline-flex min-h-11 items-center font-semibold break-all text-primary tabular-nums underline underline-offset-3"
                >
                  {patient.phone}
                </a>
              </span>
            </li>
          ) : null}
          {patient.patientCode ? (
            <li className="flex min-h-14 items-center gap-3 px-3.5 py-1.5">
              <IdCardIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="grid min-w-0">
                <span className="text-[0.8rem] text-muted-foreground">Mã bệnh nhân</span>
                <span className="font-semibold break-all">{patient.patientCode}</span>
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
