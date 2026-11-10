import { Skeleton } from '@post-tracker/ui';

export default function Loading() {
  return (
    <div className="px-4 pt-8 sm:px-8">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
