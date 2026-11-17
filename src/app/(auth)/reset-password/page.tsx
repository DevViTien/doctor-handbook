import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };

export default function ResetPasswordPage() {
  return (
    <>
      <PageHeader
        title="Đặt lại mật khẩu"
        description="Nhập mã đặt lại do quản trị viên cung cấp."
      />
      <FeaturePlaceholder module="auth" />
    </>
  );
}
