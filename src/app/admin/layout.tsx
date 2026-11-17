import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { requirePageAccess } from "@/server/auth/guards";

/** Admin area: account management only, never patient data (idea.md N6). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageAccess("admin");
  return <AdminShell>{children}</AdminShell>;
}
