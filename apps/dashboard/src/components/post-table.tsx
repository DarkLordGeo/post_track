import type { Post, Snapshot } from '@post-tracker/db';
import { METRIC_KEYS, PLATFORM_META, type MetricKey } from '@post-tracker/core';
import Link from 'next/link';
import { PlatformMark } from './platform';
import { DeltaChip, MetricValue } from './metric';
import { StatusBadge } from './status-badge';
import { postHeadline, timeAgo } from '@/lib/format';
import { latestMetrics } from '@/lib/metrics';

type Row = Post & { snapshots: Snapshot[] };

function recentDelta(snapshots: Snapshot[], key: MetricKey) {
  const [latest, prev] = snapshots;
  if (!latest || !prev || latest[key] === null || prev[key] === null) return null;
  return latest[key]! - prev[key]!;
}

export function PostTable({
  posts,
  renderAction,
}: {
  posts: Row[];
  /** Optional trailing control per row (rendered outside the row link). */
  renderAction?: (post: Row) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div
        className={`hidden gap-4 border-b ${renderAction ? 'pr-14' : ''} border-border bg-surface-2/60 px-4 py-2 text-[11px] font-medium tracking-wide text-fg-subtle uppercase xl:grid xl:grid-cols-[minmax(0,1fr)_88px_88px_88px_88px_104px]`}
      >
        <span>Post</span>
        <span className="text-right">Likes</span>
        <span className="text-right">Comments</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Views</span>
        <span className="text-right">Status</span>
        {renderAction && <span className="sr-only">Actions</span>}
      </div>
      <ul className="divide-y divide-border">
        {posts.map((post, i) => {
          const m = latestMetrics(post);
          const meta = PLATFORM_META[post.platform];
          return (
            <li
              key={post.id}
              className="flex animate-fade-up items-stretch"
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
            >
              <Link
                href={`/posts/${post.id}`}
                className="group grid min-w-0 flex-1 gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-surface-2/60 xl:grid-cols-[minmax(0,1fr)_88px_88px_88px_88px_104px] xl:items-center"
              >
                <div className="flex min-w-0 gap-3">
                  <PlatformMark platform={post.platform} className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-2">
                      {postHeadline(post)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                      {post.community && (
                        <span className="font-medium text-fg-muted">{post.community}</span>
                      )}
                      {post.community && <span aria-hidden>·</span>}
                      <span>
                        {post.authorName ? `by ${post.authorName}` : 'author unavailable'}
                      </span>
                      <span aria-hidden>·</span>
                      <span title={post.trackedAt.toISOString()}>
                        tracked {timeAgo(post.trackedAt)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pl-8 text-xs text-fg-muted xl:contents">
                  {METRIC_KEYS.map((k) => {
                    const label = meta.metrics[k];
                    return (
                      <div
                        key={k}
                        className={`${label ? 'flex' : 'hidden xl:flex'} items-baseline gap-1.5 xl:flex-col xl:items-end xl:gap-0.5`}
                      >
                        <span className="xl:hidden">{label ?? k}</span>
                        <MetricValue
                          value={m[k]}
                          className="text-sm font-medium text-fg"
                          unavailableHint={
                            label ? 'Not captured yet' : `${meta.label} does not expose ${k}`
                          }
                        />
                        <DeltaChip value={recentDelta(post.snapshots, k)} />
                      </div>
                    );
                  })}
                  <div className="xl:text-right">
                    <StatusBadge status={post.status} />
                  </div>
                </div>
              </Link>
              {renderAction && (
                <div className="flex shrink-0 items-start pt-2.5 pr-2 xl:items-center xl:pt-0">
                  {renderAction(post)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
