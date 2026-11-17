import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Kích hoạt tài khoản" };

export default function ActivatePage() {
  return (
    <>
      <PageHeader title="Kích hoạt tài khoản" description="Nhập mã do quản trị viên cung cấp." />
      <FeaturePlaceholder module="auth" />
    </>
  );
}
