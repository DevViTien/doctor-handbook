import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { todayInVietnam } from "@/modules/patients/birth";
import { AddPatientButton } from "@/modules/patients/components/add-patient-button";
import { PatientList } from "@/modules/patients/components/patient-list";
import { describePatientMeta } from "@/modules/patients/format";
import { listPatients } from "@/modules/patients/server/queries";
import { PatientSearch } from "@/modules/search/components/patient-search";
import type { SearchablePatient } from "@/modules/search/types";
import { requirePageAccess } from "@/server/auth/guards";

// A fixed title: never a patient's name (spec "Riêng tư trên màn hình và trong URL").
export const metadata: Metadata = { title: "Bệnh nhân" };

export default async function PatientsPage() {
  const auth = await requirePageAccess("doctor");
  const patients = await listPatients(auth);

  if (patients.length === 0) {
    return (
      <PageContainer>
        <header className="pt-4 pb-3">
          <h1 className="text-xl font-semibold tracking-tight">Bệnh nhân</h1>
        </header>
        <PatientList patients={patients} today={todayInVietnam()} />
      </PageContainer>
    );
  }

  // Only what the list shows goes to the browser: no phone, patient code, summary or notes.
  const today = todayInVietnam();
  const searchable: SearchablePatient[] = patients.map((patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    hometown: patient.hometown,
    meta: describePatientMeta(patient, today),
    href: routes.doctor.patient(patient.id),
  }));

  return (
    <PageContainer className="pb-24">
      <PatientSearch patients={searchable} />
      <AddPatientButton />
    </PageContainer>
  );
}
