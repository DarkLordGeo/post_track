import { listCollections } from '@post-tracker/db';
import { Card, EmptyState } from '@post-tracker/ui';
import { FolderOpen } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { NewCollectionButton } from '@/components/collections/new-collection-button';
import { PlatformStack } from '@/components/platform';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Collections' };

export default async function CollectionsPage() {
  const collections = await listCollections();

  return (
    <>
      <PageHeader
        title="Collections"
        description="Group tracked posts from any platform."
        actions={collections.length > 0 ? <NewCollectionButton /> : undefined}
      />
      <div className="px-4 py-6 sm:px-8">
        {collections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong">
            <EmptyState
              icon={<FolderOpen />}
              title="No collections yet"
              description="Create a collection to group posts about a campaign, launch or topic — Reddit, X and LinkedIn posts can sit side by side."
              action={<NewCollectionButton />}
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {collections.map((c, i) => (
              <li
                key={c.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
              >
                <Link
                  href={`/collections/${c.id}`}
                  className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <Card className="flex h-full flex-col p-5 transition-[border-color,box-shadow] group-hover:border-border-strong group-hover:shadow-pop">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 text-[15px] font-semibold tracking-tight [overflow-wrap:anywhere] text-fg">
                        {c.name}
                      </h2>
                      <PlatformStack platforms={c.platforms} className="mt-0.5 shrink-0" />
                    </div>
                    <p className="mt-auto pt-6 text-sm text-fg-muted">
                      <span className="tabular text-2xl font-semibold tracking-tight text-fg">
                        {c.postCount}
                      </span>{' '}
                      {c.postCount === 1 ? 'post' : 'posts'}
                      <span className="text-fg-subtle"> · updated {timeAgo(c.updatedAt)}</span>
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
