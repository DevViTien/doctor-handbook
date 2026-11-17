import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Tài khoản" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Tài khoản" description="Danh sách bác sĩ, khóa và mở khóa tài khoản." />
      <FeaturePlaceholder module="admin" />
    </>
  );
}
