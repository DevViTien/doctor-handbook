import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Cài đặt" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Cài đặt" />
      <FeaturePlaceholder module="auth (password), backup, patients (trash)" />
    </PageContainer>
  );
}
