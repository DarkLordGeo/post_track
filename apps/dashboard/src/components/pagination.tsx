import { cn } from '@post-tracker/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

/** Prev/next pagination that preserves the current query string. */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  searchParams,
  basePath,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
  basePath: string;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(searchParams).filter((e): e is [string, string] => !!e[1]),
    );
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const link =
    'inline-flex h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg shadow-card transition-colors hover:bg-surface-2 pointer-coarse:h-11 pointer-coarse:px-4';
  const disabled = 'pointer-events-none opacity-40';
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="tabular text-sm text-fg-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={cn(link, page <= 1 && disabled)}
          scroll={false}
        >
          <ChevronLeft className="size-4" /> Previous
        </Link>
        <span className="tabular text-sm text-fg-muted">
          {page} / {pageCount}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          className={cn(link, page >= pageCount && disabled)}
          scroll={false}
        >
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
