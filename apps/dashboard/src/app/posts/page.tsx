import { PLATFORMS, type Platform } from '@post-tracker/core';
import { listPosts, prisma, type SortKey } from '@post-tracker/db';
import { EmptyState } from '@post-tracker/ui';
import { Inbox, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app-shell';
import { PostTable } from '@/components/post-table';
import { PostsToolbar } from '@/components/posts-toolbar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tracked posts' };

const SORTS: SortKey[] = ['tracked', 'published', 'likes', 'comments', 'shares', 'views'];

export default async function PostsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const platform = PLATFORMS.includes(sp.platform as Platform) ? (sp.platform as Platform) : undefined;
  const sort = SORTS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : 'tracked';
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';
  const q = sp.q?.slice(0, 200);

  const [{ items, total }, grouped] = await Promise.all([
    listPosts({ q, platform, sort, dir, take: 100 }),
    prisma.post.groupBy({ by: ['platform'], _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.platform, g._count._all]));
  const anyTracked = grouped.length > 0;

  return (
    <>
      <PageHeader
        title="Tracked posts"
        description={anyTracked ? `${total} ${total === 1 ? 'post' : 'posts'}${q || platform ? ' match your filters' : ' in your collection'}` : 'Your collection is empty'}
      />
      <div className="space-y-4 px-4 py-6 sm:px-8">
        <Suspense>
          <PostsToolbar counts={counts} />
        </Suspense>
        {items.length > 0 ? (
          <PostTable posts={items} />
        ) : anyTracked ? (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState
              icon={<SearchX />}
              title="No posts match"
              description="Try a different search term or platform filter."
              action={<Link href="/posts" className="text-sm font-medium text-accent hover:underline">Clear filters</Link>}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState
              icon={<Inbox />}
              title="Nothing tracked yet"
              description="Install the Post Tracker extension, open a Reddit post and click “Track”. It will show up here instantly."
              action={<Link href="/extension" className="text-sm font-medium text-accent hover:underline">Set up the extension →</Link>}
            />
          </div>
        )}
      </div>
    </>
  );
}
