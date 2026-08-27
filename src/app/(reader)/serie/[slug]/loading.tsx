import { Skeleton } from "@/components/ui/Feedback";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="aspect-[2/3] w-full shrink-0 sm:w-48" />
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
