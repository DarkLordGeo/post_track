import type { Platform } from '@post-tracker/core';
import { collectionInterval, prisma, recordSnapshot } from '@post-tracker/db';
import { createRedditFetcher } from './reddit';
import type { CollectTarget, PlatformFetcher } from './types';
import { unsupportedFetcher } from './unsupported';

const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
/** After this many consecutive failures the post is marked unavailable. */
const MAX_FAILURES = 12;

export function defaultFetchers(env = process.env): PlatformFetcher[] {
  return [
    createRedditFetcher({
      clientId: env.REDDIT_CLIENT_ID || undefined,
      clientSecret: env.REDDIT_CLIENT_SECRET || undefined,
      userAgent: env.REDDIT_USER_AGENT || 'web:post-tracker:0.1.0 (local development)',
    }),
    unsupportedFetcher('X', 'X engagement requires paid API access; metrics are captured by the extension when you view the post.'),
    unsupportedFetcher('LINKEDIN', 'LinkedIn has no public engagement API; metrics are captured by the extension when you view the post.'),
  ];
}

export interface CollectSummary {
  checked: number;
  collected: number;
  failed: number;
  unavailable: number;
  skipped: number;
  rateLimited: Platform[];
  notes: string[];
}

export interface CollectOptions {
  fetchers?: PlatformFetcher[];
  limit?: number;
  /** Restrict to specific post ids (ignores the schedule — used by "collect now"). */
  postIds?: string[];
  now?: Date;
}

export async function collectDue(opts: CollectOptions = {}): Promise<CollectSummary> {
  const now = opts.now ?? new Date();
  const fetchers = opts.fetchers ?? defaultFetchers();
  const summary: CollectSummary = { checked: 0, collected: 0, failed: 0, unavailable: 0, skipped: 0, rateLimited: [], notes: [] };

  const due = await prisma.post.findMany({
    where: opts.postIds
      ? { id: { in: opts.postIds } }
      : { status: 'ACTIVE', OR: [{ nextCollectAt: null }, { nextCollectAt: { lte: now } }] },
    orderBy: { nextCollectAt: 'asc' },
    take: opts.limit ?? 500,
    select: { id: true, platform: true, platformPostId: true, publishedAt: true, consecutiveFailures: true },
  });

  for (const fetcher of fetchers) {
    const posts = due.filter((p) => p.platform === fetcher.platform);
    for (let i = 0; i < posts.length; i += fetcher.batchSize) {
      const batch = posts.slice(i, i + fetcher.batchSize);
      const targets: CollectTarget[] = batch.map(({ id, platform, platformPostId }) => ({ id, platform, platformPostId }));
      summary.checked += batch.length; // attempted; rolled back below if the batch is rate limited
      const result = await fetcher.fetchBatch(targets);

      if (result.kind === 'unsupported') {
        summary.skipped += batch.length;
        if (!summary.notes.includes(result.reason)) summary.notes.push(result.reason);
        await Promise.all(
          batch.map((p) =>
            prisma.post.update({
              where: { id: p.id },
              data: {
                lastError: result.reason,
                nextCollectAt: new Date(now.getTime() + collectionInterval(p.publishedAt, now)),
              },
            }),
          ),
        );
        continue;
      }

      if (result.kind === 'rate-limited') {
        summary.rateLimited.push(fetcher.platform);
        const remaining = posts.slice(i);
        await prisma.post.updateMany({
          where: { id: { in: remaining.map((p) => p.id) } },
          data: { nextCollectAt: result.retryAt, lastError: `Rate limited until ${result.retryAt.toISOString()}` },
        });
        summary.checked -= batch.length;
        summary.skipped += remaining.length;
        break;
      }

      for (const post of batch) {
        const r = result.results.get(post.id) ?? { kind: 'error' as const, reason: 'No result returned' };
        const interval = collectionInterval(post.publishedAt, now);
        if (r.kind === 'ok') {
          await recordSnapshot(post.id, r.metrics, 'COLLECTOR', now);
          await prisma.post.update({
            where: { id: post.id },
            data: { lastCollectedAt: now, nextCollectAt: new Date(now.getTime() + interval), consecutiveFailures: 0, lastError: null },
          });
          summary.collected++;
        } else if (r.kind === 'gone') {
          await prisma.post.update({
            where: { id: post.id },
            data: { status: 'UNAVAILABLE', lastCollectedAt: now, lastError: r.reason, nextCollectAt: null },
          });
          summary.unavailable++;
        } else {
          const failures = post.consecutiveFailures + 1;
          const backoff = Math.min(interval * 2 ** failures, MAX_BACKOFF_MS);
          await prisma.post.update({
            where: { id: post.id },
            data: {
              consecutiveFailures: failures,
              lastError: r.reason,
              nextCollectAt: new Date(now.getTime() + backoff),
              ...(failures >= MAX_FAILURES ? { status: 'UNAVAILABLE' as const } : {}),
            },
          });
          summary.failed++;
        }
      }

      if (result.retryAt) {
        const remaining = posts.slice(i + fetcher.batchSize);
        if (remaining.length) {
          summary.rateLimited.push(fetcher.platform);
          await prisma.post.updateMany({ where: { id: { in: remaining.map((p) => p.id) } }, data: { nextCollectAt: result.retryAt } });
          summary.skipped += remaining.length;
        }
        break;
      }
    }
  }
  return summary;
}
