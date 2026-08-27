import { Skeleton } from "@/components/ui/Feedback";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-12 w-56" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  );
}
