import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div className="space-y-3 py-4" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
