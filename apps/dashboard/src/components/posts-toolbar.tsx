'use client';

import { PLATFORM_META, PLATFORMS } from '@post-tracker/core';
import { cn, Input, Select } from '@post-tracker/ui';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const SORTS = [
  ['tracked', 'Date tracked'],
  ['published', 'Date published'],
  ['likes', 'Likes / score'],
  ['comments', 'Comments'],
  ['shares', 'Shares'],
  ['views', 'Views'],
] as const;

export function PostsToolbar({
  counts,
  collections,
}: {
  counts: Record<string, number>;
  collections: { id: string; name: string; postCount: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    // Any filter/sort change starts again from the first page.
    if (!('page' in patch)) next.delete('page');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === (params.get('q') ?? '')) return;
    const t = setTimeout(() => update({ q }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const platform = params.get('platform');
  const dir = params.get('dir') ?? 'desc';
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div
        className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5"
        role="tablist"
        aria-label="Platform"
      >
        {[null, ...PLATFORMS].map((p) => {
          const active = platform === p || (!platform && p === null);
          return (
            <button
              key={p ?? 'all'}
              role="tab"
              aria-selected={active}
              onClick={() => update({ platform: p })}
              className={cn(
                'inline-flex items-center rounded-md px-2.5 py-1 text-[13px] font-medium transition-all pointer-coarse:min-h-10 pointer-coarse:px-3',
                active
                  ? 'bg-surface text-fg shadow-card ring-1 ring-border'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {p ? PLATFORM_META[p].label : 'All'}
              <span className="tabular ml-1.5 text-fg-subtle">{p ? (counts[p] ?? 0) : total}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-56 sm:flex-1 xl:w-64 xl:flex-none">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, text, author…"
            className="pl-8"
            aria-label="Search posts"
          />
        </div>
        {collections.length > 0 && (
          <Select
            value={params.get('collection') ?? ''}
            onChange={(e) => update({ collection: e.target.value || null })}
            aria-label="Filter by collection"
            className="min-w-0 max-w-full flex-1 sm:max-w-56 sm:flex-none"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.postCount})
              </option>
            ))}
          </Select>
        )}
        <Select
          className="min-w-0 flex-1 sm:flex-none"
          value={params.get('sort') ?? 'tracked'}
          onChange={(e) => update({ sort: e.target.value })}
          aria-label="Sort by"
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <button
          onClick={() => update({ dir: dir === 'desc' ? 'asc' : 'desc' })}
          className="grid size-9 shrink-0 place-items-center rounded-md border pointer-coarse:size-11 border-border bg-surface text-fg-muted shadow-card transition-colors hover:text-fg"
          aria-label={dir === 'desc' ? 'Sorted descending' : 'Sorted ascending'}
          title={dir === 'desc' ? 'Descending' : 'Ascending'}
        >
          {dir === 'desc' ? (
            <ArrowDownWideNarrow className="size-4" />
          ) : (
            <ArrowUpNarrowWide className="size-4" />
          )}
        </button>
        <span
          className={cn(
            'size-1.5 rounded-full bg-accent transition-opacity',
            pending ? 'opacity-100 animate-pulse' : 'opacity-0',
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
