import { PLATFORMS, type Platform } from '@post-tracker/core';
import { getCollection, listPosts, prisma } from '@post-tracker/db';
import { EmptyState } from '@post-tracker/ui';
import { ArrowLeft, Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionActions } from '@/components/collections/collection-actions';
import { RemoveFromCollectionButton } from '@/components/collections/remove-from-collection-button';
import { Pagination } from '@/components/pagination';
import { PlatformMark } from '@/components/platform';
import { PostTable } from '@/components/post-table';
import { postHeadline } from '@/lib/format';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollection((await params).id);
  return { title: c?.name ?? 'Collection not found' };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const collection = await getCollection(id);
  if (!collection) notFound();

  const platform = PLATFORMS.includes(sp.platform as Platform)
    ? (sp.platform as Platform)
    : undefined;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const [{ items, total }, grouped] = await Promise.all([
    listPosts({ collectionId: id, platform, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    prisma.post.groupBy({
      by: ['platform'],
      where: { collections: { some: { collectionId: id } } },
      _count: { _all: true },
    }),
  ]);
  const byPlatform = PLATFORMS.map((p) => ({
    p,
    n: grouped.find((g) => g.platform === p)?._count._all ?? 0,
  }));

  return (
    <div className="animate-fade-up">
      <div className="border-b border-border px-4 pt-6 pb-5 sm:px-8">
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" /> Collections
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere] text-fg">
              {collection.name}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              {collection.postCount} {collection.postCount === 1 ? 'post' : 'posts'}
            </p>
          </div>
          <CollectionActions
            collection={{
              id: collection.id,
              name: collection.name,
              postCount: collection.postCount,
            }}
          />
        </div>
        {collection.postCount > 0 && (
          <nav className="mt-5 flex flex-wrap gap-1" aria-label="Filter by platform">
            <FilterLink href={`/collections/${id}`} active={!platform}>
              All <span className="tabular text-fg-subtle">{collection.postCount}</span>
            </FilterLink>
            {byPlatform
              .filter(({ n }) => n > 0)
              .map(({ p, n }) => (
                <FilterLink
                  key={p}
                  href={`/collections/${id}?platform=${p}`}
                  active={platform === p}
                >
                  <PlatformMark platform={p} className="size-3.5" />{' '}
                  <span className="tabular text-fg-subtle">{n}</span>
                </FilterLink>
              ))}
          </nav>
        )}
      </div>

      <div className="space-y-4 px-4 py-6 sm:px-8">
        {items.length > 0 ? (
          <>
            <PostTable
              posts={items}
              renderAction={(post) => (
                <RemoveFromCollectionButton
                  collectionId={id}
                  postId={post.id}
                  postTitle={postHeadline(post)}
                />
              )}
            />
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              total={total}
              pageSize={PAGE_SIZE}
              searchParams={sp}
              basePath={`/collections/${id}`}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState
              icon={<Inbox />}
              title={
                collection.postCount === 0 ? 'This collection is empty' : 'No posts on this page'
              }
              description={
                collection.postCount === 0
                  ? 'Use “Add posts” to pick tracked posts from Reddit, X or LinkedIn, or add a post from its detail page.'
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors pointer-coarse:h-10 pointer-coarse:px-3 ${
        active
          ? 'bg-surface text-fg shadow-card ring-1 ring-border'
          : 'text-fg-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      {children}
    </Link>
  );
}
