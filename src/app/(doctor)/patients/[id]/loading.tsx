import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientLoading() {
  return (
    <PageContainer className="space-y-4 py-3" aria-busy="true">
      <Skeleton className="h-9 w-32" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </PageContainer>
  );
}
