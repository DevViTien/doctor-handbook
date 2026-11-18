import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { todayInVietnam } from "@/modules/patients/birth";
import { AddPatientButton } from "@/modules/patients/components/add-patient-button";
import { PatientList } from "@/modules/patients/components/patient-list";
import { listPatients } from "@/modules/patients/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

// A fixed title: never a patient's name (spec "Riêng tư trên màn hình và trong URL").
export const metadata: Metadata = { title: "Bệnh nhân" };

export default async function PatientsPage() {
  const auth = await requirePageAccess("doctor");
  const patients = await listPatients(auth);

  return (
    <PageContainer className={patients.length > 0 ? "pb-24" : undefined}>
      <header className="flex items-baseline justify-between gap-3 pt-4 pb-3">
        <h1 className="text-xl font-semibold tracking-tight">Bệnh nhân</h1>
        {patients.length > 0 ? (
          <p className="text-sm whitespace-nowrap text-muted-foreground">
            {patients.length} bệnh nhân
          </p>
        ) : null}
      </header>
      <PatientList patients={patients} today={todayInVietnam()} />
      {patients.length > 0 ? <AddPatientButton /> : null}
    </PageContainer>
  );
}
