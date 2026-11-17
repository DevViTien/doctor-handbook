import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Việc cần làm" };

export default function TodosPage() {
  return (
    <PageContainer>
      <PageHeader title="Việc cần làm" />
      <FeaturePlaceholder module="todos" />
    </PageContainer>
  );
}
