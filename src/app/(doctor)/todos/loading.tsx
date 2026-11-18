import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function TodosLoading() {
  return (
    <PageContainer className="space-y-3 py-4" aria-busy="true">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-13 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </PageContainer>
  );
}
