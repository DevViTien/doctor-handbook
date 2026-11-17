import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorLoading() {
  return (
    <PageContainer className="space-y-3 py-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </PageContainer>
  );
}
