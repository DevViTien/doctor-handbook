import { PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { todayInVietnam } from "@/modules/patients/birth";
import { PatientHeader } from "@/modules/patients/components/patient-header";
import { PatientNotes } from "@/modules/patients/components/patient-notes";
import { PatientPageBar } from "@/modules/patients/components/patient-page-bar";
import { PatientSummary } from "@/modules/patients/components/patient-summary";
import { patientIdSchema } from "@/modules/patients/schemas";
import { getPatient, listNotes } from "@/modules/patients/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

// Never the patient's name: the tab title is visible to anyone near the screen.
export const metadata: Metadata = { title: "Bệnh nhân" };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePageAccess("doctor");
  const { id } = await params;
  // Malformed id, another doctor's patient, unknown id: the same "not found" page.
  const patientId = patientIdSchema.safeParse(id);
  if (!patientId.success) notFound();
  const patient = await getPatient(auth, patientId.data);
  if (!patient) notFound();

  const notes = await listNotes(auth, patient.id);
  const editHref = routes.doctor.editPatient(patient.id);

  return (
    // Bottom padding keeps the last note clear of the floating "Ghi chú mới" button.
    <PageContainer className="pb-24">
      <PatientPageBar
        backHref={routes.doctor.patients}
        backLabel="Bệnh nhân"
        actions={
          <Button asChild variant="outline" className="h-11 px-3.5">
            <Link href={editHref}>
              <PencilIcon className="size-4" aria-hidden />
              Sửa
            </Link>
          </Button>
        }
      />
      <PatientHeader patient={patient} today={todayInVietnam()} />
      <PatientSummary summary={patient.summary} editHref={editHref} />
      <PatientNotes accountId={auth.account.id} patientId={patient.id} initialNotes={notes} />
    </PageContainer>
  );
}
