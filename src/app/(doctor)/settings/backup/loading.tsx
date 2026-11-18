import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function BackupLoading() {
  return (
    <PageContainer className="space-y-3.5 py-3" aria-busy="true">
      <Skeleton className="h-9 w-28" />
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
    </PageContainer>
  );
}
