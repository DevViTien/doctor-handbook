import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { AccessCodeList } from "@/modules/admin/components/access-code-list";
import { CreateAccessCodeForm } from "@/modules/admin/components/create-access-code-form";
import { listAccessCodes } from "@/modules/admin/server/queries";
import { requirePageAccess } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Mã truy cập" };

export default async function AccessCodesPage() {
  // The layout already checks, but every data read re-checks (layouts do not re-run on
  // client-side navigation). Cached per request, so this costs nothing extra.
  await requirePageAccess("admin");
  const items = await listAccessCodes();
  const now = new Date();

  return (
    <div className="pb-8">
      <PageHeader
        title="Mã truy cập"
        description="Mã kích hoạt cho bác sĩ mới. Mỗi mã dùng một lần, hiệu lực 72 giờ."
      />
      <div className="grid items-start gap-4 md:grid-cols-[360px_minmax(0,1fr)] md:gap-6">
        <CreateAccessCodeForm />
        <AccessCodeList items={items} now={now} />
      </div>
    </div>
  );
}
