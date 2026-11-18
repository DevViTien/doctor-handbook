import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { AccountList } from "@/modules/admin/components/account-list";
import { listDoctorAccounts } from "@/modules/admin/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Tài khoản" };

export default async function AccountsPage() {
  // Re-checked here: layouts do not re-run on client-side navigation (cached per request).
  await requirePageAccess("admin");
  const accounts = await listDoctorAccounts();

  return (
    <div className="pb-8">
      <PageHeader
        title="Tài khoản"
        description="Tài khoản bác sĩ. Khoá khi bác sĩ mất máy hoặc ngừng dùng app."
      />
      <AccountList accounts={accounts} />
    </div>
  );
}
