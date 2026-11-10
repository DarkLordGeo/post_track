import { METRIC_KEYS, PLATFORM_META, type MediaRef } from '@post-tracker/core';
import { getPost } from '@post-tracker/db';
import { Card, CardContent, CardHeader, CardTitle } from '@post-tracker/ui';
import { ArrowLeft, ExternalLink, ImageIcon, Link2, Video } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EngagementChart, type ChartPoint } from '@/components/engagement-chart';
import { DeltaChip, MetricValue } from '@/components/metric';
import { PlatformLabel } from '@/components/platform';
import { PostActions } from '@/components/post-actions';
import { StatusBadge } from '@/components/status-badge';
import { formatCount, formatDateTime, postHeadline, timeAgo } from '@/lib/format';
import { latestMetrics, metricDelta } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  return { title: post ? postHeadline(post).slice(0, 60) : 'Post not found' };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">
        {children ?? <span className="text-fg-subtle">Unavailable</span>}
      </dd>
    </div>
  );
}

const MEDIA_ICON = { image: ImageIcon, video: Video, link: Link2 };

export default async function PostPage({ params }: Props) {
  const post = await getPost((await params).id);
  if (!post) notFound();

  const meta = PLATFORM_META[post.platform];
  const latest = latestMetrics(post);
  const media = (Array.isArray(post.media) ? post.media : []) as unknown as MediaRef[];
  const points: ChartPoint[] = post.snapshots.map((s) => ({
    t: s.capturedAt.getTime(),
    source: s.source,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    views: s.views,
  }));
  const history = [...post.snapshots].reverse();

  return (
    <div className="animate-fade-up">
      <div className="border-b border-border px-4 pt-6 pb-5 sm:px-8">
        <Link
          href="/posts"
          className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" /> Tracked posts
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformLabel platform={post.platform} />
              {post.community && (
                <span className="text-[13px] text-fg-muted">· {post.community}</span>
              )}
              <StatusBadge status={post.status} />
            </div>
            <h1 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-pretty text-fg">
              {postHeadline(post)}
            </h1>
            <a
              href={post.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-accent"
            >
              Open on {meta.label} <ExternalLink className="size-3" />
            </a>
          </div>
          <PostActions id={post.id} status={post.status} />
        </div>
      </div>

      <div className="grid gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {METRIC_KEYS.map((k) => {
              const label = meta.metrics[k];
              const supported = !!label;
              return (
                <Card key={k} className={supported ? 'p-4' : 'p-4 bg-surface-2/50 shadow-none'}>
                  <p className="text-xs font-medium text-fg-muted">
                    {label ?? k[0]!.toUpperCase() + k.slice(1)}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <MetricValue
                      value={latest[k]}
                      mode="full"
                      className="text-2xl font-semibold tracking-tight text-fg"
                      unavailableHint={
                        supported ? 'Not captured yet' : `${meta.label} does not expose this metric`
                      }
                    />
                    <DeltaChip value={metricDelta(post.snapshots, k)} />
                  </div>
                  <p className="mt-1 text-[11px] text-fg-subtle">
                    {!supported
                      ? `Not provided by ${meta.label}`
                      : latest[k] === null
                        ? 'Not captured yet'
                        : 'since tracking began'}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Engagement over time</CardTitle>
              <span className="text-xs text-fg-subtle">{post.snapshots.length} snapshots</span>
            </CardHeader>
            <CardContent>
              <EngagementChart platform={post.platform} points={points} />
            </CardContent>
          </Card>

          {post.contentPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Content preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-line text-fg-muted">
                  {post.contentPreview}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Snapshot history</CardTitle>
            </CardHeader>
            {history.length === 0 ? (
              <CardContent>
                <p className="text-sm text-fg-muted">
                  No snapshots yet. Metrics are recorded when you view the post with the extension,
                  or by the collector.
                </p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-y border-border bg-surface-2/60 text-[11px] tracking-wide text-fg-subtle uppercase">
                      <th className="px-5 py-2 text-left font-medium">Captured</th>
                      {METRIC_KEYS.map((k) => (
                        <th key={k} className="px-3 py-2 text-right font-medium">
                          {meta.metrics[k] ?? k}
                        </th>
                      ))}
                      <th className="px-5 py-2 text-right font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.slice(0, 50).map((s) => (
                      <tr key={s.id} className="hover:bg-surface-2/40">
                        <td
                          className="px-5 py-2 whitespace-nowrap text-fg-muted"
                          title={s.capturedAt.toISOString()}
                        >
                          {formatDateTime(s.capturedAt)}
                        </td>
                        {METRIC_KEYS.map((k) => (
                          <td key={k} className="px-3 py-2 text-right">
                            <MetricValue value={s[k]} mode="full" />
                          </td>
                        ))}
                        <td className="px-5 py-2 text-right text-xs text-fg-subtle">
                          {s.source === 'COLLECTOR' ? 'Collector' : 'Extension'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="Author">
                  {post.authorName &&
                    (post.authorUrl ? (
                      <a
                        href={post.authorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent"
                      >
                        {post.authorHandle ?? post.authorName}
                      </a>
                    ) : (
                      post.authorName
                    ))}
                </Row>
                <Row label="Published">
                  {post.publishedAt && (
                    <span title={post.publishedAt.toISOString()}>
                      {formatDateTime(post.publishedAt)}
                    </span>
                  )}
                </Row>
                <Row label="Tracked">{formatDateTime(post.trackedAt)}</Row>
                <Row label="Post ID">
                  <code className="font-mono text-xs">{post.platformPostId}</code>
                </Row>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Row label="Status">
                  <StatusBadge status={post.status} />
                </Row>
                <Row label="Last collected">
                  {post.lastCollectedAt ? (
                    timeAgo(post.lastCollectedAt)
                  ) : (
                    <span className="text-fg-subtle">Never</span>
                  )}
                </Row>
                <Row label="Next run">
                  {post.status === 'ACTIVE' && post.nextCollectAt ? (
                    timeAgo(post.nextCollectAt)
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </Row>
                <Row label="Snapshots">{formatCount(post.snapshots.length)}</Row>
              </dl>
              {post.lastError && (
                <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-xs leading-relaxed text-fg-muted">
                  {post.lastError}
                </p>
              )}
            </CardContent>
          </Card>

          {media.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Media & links</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {media.map((m) => {
                    const Icon = MEDIA_ICON[m.type];
                    return (
                      <li key={m.url}>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-sm text-fg-muted hover:text-accent"
                        >
                          <Icon className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {new URL(m.url).hostname + new URL(m.url).pathname}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
