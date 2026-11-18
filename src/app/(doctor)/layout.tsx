import type { CSSProperties, ReactNode } from "react";

import { DoctorShell } from "@/components/layout/doctor-shell";
import { Toaster } from "@/components/ui/sonner";
import { DOCTOR_TOASTER_ID } from "@/config/site";
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
      {/* Notices such as "Hoàn tác" (spec patient-trash): inverted colours, above the floating
          button and the bottom navigation (thumb zone), never containing patient data. */}
      <Toaster
        id={DOCTOR_TOASTER_ID}
        containerAriaLabel="Thông báo của sổ tay"
        position="bottom-center"
        offset={{ bottom: "calc(8.75rem + env(safe-area-inset-bottom))" }}
        mobileOffset={{ bottom: "calc(8.75rem + env(safe-area-inset-bottom))" }}
        style={
          {
            "--normal-bg": "var(--foreground)",
            "--normal-text": "var(--background)",
            "--normal-border": "var(--foreground)",
            "--border-radius": "var(--radius-lg)",
          } as CSSProperties
        }
        toastOptions={{ classNames: { actionButton: "!font-bold !underline" } }}
      />
    </DoctorShell>
  );
}
