import { HammerIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";

/**
 * TEMPORARY scaffold marker for screens whose feature is not implemented yet.
 * Delete this component once every route renders its real module UI.
 */
export function FeaturePlaceholder({ module }: { module: string }) {
  return (
    <EmptyState
      icon={HammerIcon}
      title="Tính năng đang được xây dựng"
      description={`Module: ${module}`}
    />
  );
}
