import type { ReactNode } from "react";

import { DoctorShell } from "@/components/layout/doctor-shell";
import { requirePageAccess } from "@/server/auth/guards";

/**
 * Doctor area. This check gates rendering only; every DAL function and Server Action
 * re-checks access itself (layouts do not re-run on client-side navigation).
 */
export default async function DoctorLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("doctor");
  return <DoctorShell>{children}</DoctorShell>;
}
