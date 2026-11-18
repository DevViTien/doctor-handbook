import type { ReactNode } from "react";

import { DoctorShell } from "@/components/layout/doctor-shell";
import { NoteDraftSync } from "@/modules/patients/components/note-draft-sync";
import { requirePageAccess } from "@/server/auth/guards";

/**
 * Doctor area. This check gates rendering only; every DAL function and Server Action
 * re-checks access itself (layouts do not re-run on client-side navigation).
 */
export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const auth = await requirePageAccess("doctor");
  return (
    <DoctorShell>
      {children}
      {/* Sends notes written offline from any doctor page (spec patient-notes). */}
      <NoteDraftSync accountId={auth.account.id} />
    </DoctorShell>
  );
}
