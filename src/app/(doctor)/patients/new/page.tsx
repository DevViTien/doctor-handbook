import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { PatientForm } from "@/modules/patients/components/patient-form";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { listPatients } from "@/modules/patients/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Thêm bệnh nhân" };

const EMPTY_VALUES = {
  fullName: "",
  birth: "",
  gender: "",
  hometown: "",
  phone: "",
  patientCode: "",
  summary: "",
};

export default async function NewPatientPage() {
  const auth = await requirePageAccess("doctor");
  // Candidates for "Có phải người này?": exactly what the list page already shows.
  const candidates = await listPatients(auth);

  return (
    <PageContainer>
      <PatientPageBar backHref={routes.doctor.patients} title="Thêm bệnh nhân" />
      <PatientForm mode="create" initialValues={EMPTY_VALUES} candidates={candidates} />
    </PageContainer>
  );
}
