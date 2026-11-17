import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Mã truy cập" };

export default function AccessCodesPage() {
  return (
    <>
      <PageHeader
        title="Mã truy cập"
        description="Mã kích hoạt và mã đặt lại mật khẩu, hiệu lực 72 giờ."
      />
      <FeaturePlaceholder module="admin" />
    </>
  );
}
