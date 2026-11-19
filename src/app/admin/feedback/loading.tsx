import { Skeleton } from "@/components/ui/skeleton";

export default function AdminFeedbackLoading() {
  return (
    <div className="space-y-3 py-4" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
