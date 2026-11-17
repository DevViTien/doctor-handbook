import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Bệnh nhân" };

export default function PatientsPage() {
  return (
    <PageContainer>
      <PageHeader title="Bệnh nhân" />
      <FeaturePlaceholder module="patients, search" />
    </PageContainer>
  );
}
