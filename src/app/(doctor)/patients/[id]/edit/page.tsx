import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { routes } from "@/config/routes";
import { formatBirthInput } from "@/modules/patients/birth";
import { PatientForm } from "@/modules/patients/components/patient-form";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { patientIdSchema } from "@/modules/patients/schemas";
import { getPatient } from "@/modules/patients/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Sửa thông tin" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePageAccess("doctor");
  const { id } = await params;
  const patientId = patientIdSchema.safeParse(id);
  if (!patientId.success) notFound();
  const patient = await getPatient(auth, patientId.data);
  if (!patient) notFound();

  return (
    <PageContainer>
      <PatientPageBar backHref={routes.doctor.patient(patient.id)} title="Sửa thông tin" />
      <PatientForm
        mode="edit"
        patientId={patient.id}
        version={patient.version}
        initialValues={{
          fullName: patient.fullName,
          birth: formatBirthInput(patient),
          gender: patient.gender ?? "",
          hometown: patient.hometown ?? "",
          phone: patient.phone ?? "",
          patientCode: patient.patientCode ?? "",
          summary: patient.summary ?? "",
        }}
      />
    </PageContainer>
  );
}
