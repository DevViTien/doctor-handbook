import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { formatDate } from "@/lib/date/format";
import { todayInVietnam } from "@/modules/patients/birth";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { TrashList, type TrashRow } from "@/modules/patients/components/trash-list";
import { describePatientMeta } from "@/modules/patients/format";
import { listTrash } from "@/modules/patients/server/queries";
import { daysLeft } from "@/modules/patients/trash";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Thùng rác" };

export default async function TrashPage() {
  const auth = await requirePageAccess("doctor");
  const trashed = await listTrash(auth);
  const today = todayInVietnam();
  const now = new Date();

  const rows: TrashRow[] = trashed.map((patient) => {
    const left = daysLeft(patient.deletedAt, now);
    return {
      id: patient.id,
      fullName: patient.fullName,
      meta: describePatientMeta(patient, today),
      expiry: `Xoá ngày ${formatDate(patient.deletedAt)} · còn ${left} ngày`,
      lastDay: left === 1,
      avatarSrc: patient.avatarUrl,
    };
  });

  return (
    <PageContainer className="pb-6">
      <PatientPageBar backHref={routes.doctor.settings} backLabel="Cài đặt" />
      <header className="flex items-baseline justify-between gap-3 pt-1 pb-1">
        <h1 className="text-xl font-semibold tracking-tight">Thùng rác</h1>
        {rows.length > 0 ? (
          <p className="text-sm whitespace-nowrap text-muted-foreground">{rows.length} bệnh nhân</p>
        ) : null}
      </header>
      <p className="mb-3.5 text-[0.9rem] text-muted-foreground">
        Bệnh nhân ở đây được xoá hẳn sau 30 ngày.
      </p>
      <TrashList accountId={auth.account.id} rows={rows} />
    </PageContainer>
  );
}
