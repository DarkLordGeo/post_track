import { PLATFORM_META, PLATFORMS } from '@post-tracker/core';
import { overviewStats, topMovers } from '@post-tracker/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@post-tracker/ui';
import { Activity, ArrowRight, Inbox, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { DeltaChip, MetricValue } from '@/components/metric';
import { PlatformMark } from '@/components/platform';
import { formatCount, postHeadline, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="tabular mt-2 text-[28px] leading-none font-semibold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-2 text-xs text-fg-subtle">{hint}</p>}
    </Card>
  );
}

export default async function OverviewPage() {
  const [stats, movers] = await Promise.all([overviewStats(), topMovers()]);
  const redditCollector = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

  return (
    <>
      <PageHeader title="Overview" description="Your social listening at a glance." />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Tracked posts" value={formatCount(stats.total, 'full')} hint={`${stats.byStatus.ACTIVE ?? 0} actively monitored`} />
          <Kpi label="Snapshots · 24h" value={formatCount(stats.snapshots24h, 'full')} hint="engagement data points captured" />
          <Kpi label="Paused" value={formatCount(stats.byStatus.PAUSED ?? 0, 'full')} hint="excluded from collection" />
          <Kpi label="Unavailable" value={formatCount(stats.byStatus.UNAVAILABLE ?? 0, 'full')} hint="deleted or removed posts" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Recently tracked</CardTitle>
              <Link href="/posts" className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg">
                View all <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            {stats.recent.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title="Start your collection"
                description="Open any Reddit post with the extension installed and click “Track”."
                action={<Link href="/extension" className="text-sm font-medium text-accent hover:underline">Install the extension →</Link>}
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {stats.recent.map((p) => (
                  <li key={p.id}>
                    <Link href={`/posts/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60">
                      <PlatformMark platform={p.platform} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{postHeadline(p)}</p>
                        <p className="text-xs text-fg-muted">
                          {p.community ?? PLATFORM_META[p.platform].label} · tracked {timeAgo(p.trackedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <MetricValue value={p.latestLikes} className="text-sm font-medium text-fg" />
                        <p className="text-[11px] text-fg-subtle">{PLATFORM_META[p.platform].metrics.likes?.toLowerCase()}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platforms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PLATFORMS.map((p) => {
                  const n = stats.byPlatform[p] ?? 0;
                  const pct = stats.total ? (n / stats.total) * 100 : 0;
                  return (
                    <div key={p}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-fg">
                          <PlatformMark platform={p} className="size-4" /> {PLATFORM_META[p].label}
                        </span>
                        <span className="tabular text-fg-muted">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-fg/70 transition-[width] duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5"><TrendingUp className="size-3.5 text-accent" /> Top movers · 24h</CardTitle>
              </CardHeader>
              {movers.length === 0 ? (
                <CardContent>
                  <p className="text-sm text-fg-muted">No engagement changes recorded in the last 24 hours.</p>
                </CardContent>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {movers.map(({ post, delta }) => (
                    <li key={post.id}>
                      <Link href={`/posts/${post.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                        <PlatformMark platform={post.platform} className="size-4" />
                        <span className="min-w-0 flex-1 truncate text-sm text-fg">{postHeadline(post)}</span>
                        <DeltaChip value={delta} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5"><Activity className="size-3.5" /> Data sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-fg-muted">
                <p>
                  <span className="font-medium text-fg">Extension</span> — records visible metrics whenever you view a tracked post.
                </p>
                <p>
                  <span className="font-medium text-fg">Reddit collector</span> —{' '}
                  {redditCollector ? (
                    <span className="text-accent">configured</span>
                  ) : (
                    <>needs <code className="font-mono text-xs">REDDIT_CLIENT_ID</code>/<code className="font-mono text-xs">SECRET</code></>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
