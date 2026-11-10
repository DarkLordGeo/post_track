import type { Platform, Prisma, SnapshotSource, TrackingStatus } from '@prisma/client';
import { hasAnyMetric, postKey, type Metrics, type TrackPostInput } from '@post-tracker/core';
import { prisma } from './client';

const HOUR = 60 * 60 * 1000;
/** Extension observations closer together than this are folded into the previous snapshot. */
export const OBSERVE_MIN_INTERVAL_MS = 15 * 60 * 1000;

/** Younger posts move faster, so they are sampled more often. */
export function collectionInterval(publishedAt: Date | null, now = new Date()): number {
  const age = publishedAt ? now.getTime() - publishedAt.getTime() : Number.POSITIVE_INFINITY;
  if (age < 24 * HOUR) return HOUR;
  if (age < 7 * 24 * HOUR) return 6 * HOUR;
  return 24 * HOUR;
}

function latestFields(m: Metrics) {
  return {
    latestLikes: m.likes,
    latestComments: m.comments,
    latestShares: m.shares,
    latestViews: m.views,
  };
}

export async function trackPost(input: TrackPostInput) {
  const where = {
    platform_platformPostId: { platform: input.platform, platformPostId: input.platformPostId },
  };
  const existing = await prisma.post.findUnique({ where });
  if (existing) {
    // Never overwrite stored data on a duplicate track; only backfill fields we did not have.
    const backfill: Prisma.PostUpdateInput = {};
    if (!existing.authorName && input.authorName) backfill.authorName = input.authorName;
    if (!existing.authorUrl && input.authorUrl) backfill.authorUrl = input.authorUrl;
    if (!existing.contentPreview && input.contentPreview)
      backfill.contentPreview = input.contentPreview;
    if (!existing.publishedAt && input.publishedAt)
      backfill.publishedAt = new Date(input.publishedAt);
    const post = Object.keys(backfill).length
      ? await prisma.post.update({ where: { id: existing.id }, data: backfill })
      : existing;
    return { post, created: false };
  }

  const now = new Date();
  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const withMetrics = hasAnyMetric(input.metrics);
  try {
    const post = await prisma.post.create({
      data: {
        platform: input.platform,
        platformPostId: input.platformPostId,
        canonicalUrl: input.canonicalUrl,
        originalUrl: input.originalUrl,
        authorName: input.authorName,
        authorHandle: input.authorHandle,
        authorUrl: input.authorUrl,
        title: input.title,
        contentPreview: input.contentPreview,
        community: input.community,
        media: input.media,
        publishedAt,
        trackedAt: now,
        nextCollectAt: new Date(now.getTime() + collectionInterval(publishedAt, now)),
        ...latestFields(input.metrics),
        snapshots: withMetrics
          ? { create: { capturedAt: now, source: 'EXTENSION', ...input.metrics } }
          : undefined,
      },
    });
    return { post, created: true };
  } catch (err) {
    // Two concurrent track requests: the unique constraint wins, report as duplicate.
    if ((err as { code?: string }).code === 'P2002') {
      const post = await prisma.post.findUniqueOrThrow({ where });
      return { post, created: false };
    }
    throw err;
  }
}

export async function lookupTracked(keys: { platform: Platform; platformPostId: string }[]) {
  if (keys.length === 0) return {};
  const rows = await prisma.post.findMany({
    where: { OR: keys.map((k) => ({ platform: k.platform, platformPostId: k.platformPostId })) },
    select: { id: true, platform: true, platformPostId: true },
  });
  return Object.fromEntries(rows.map((r) => [postKey(r), r.id]));
}

export async function recordSnapshot(
  postId: string,
  metrics: Metrics,
  source: SnapshotSource,
  capturedAt = new Date(),
) {
  if (!hasAnyMetric(metrics)) return null;
  const [snapshot] = await prisma.$transaction([
    prisma.snapshot.create({ data: { postId, source, capturedAt, ...metrics } }),
    prisma.post.update({ where: { id: postId }, data: latestFields(metrics) }),
  ]);
  return snapshot;
}

/** Metrics seen by the extension while the user browses a tracked post. Throttled. */
export async function observePost(platform: Platform, platformPostId: string, metrics: Metrics) {
  const post = await prisma.post.findUnique({
    where: { platform_platformPostId: { platform, platformPostId } },
    include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 1 } },
  });
  if (!post) return { recorded: false, reason: 'not-tracked' as const };
  if (post.status === 'PAUSED') return { recorded: false, reason: 'paused' as const };
  const last = post.snapshots[0];
  if (last && Date.now() - last.capturedAt.getTime() < OBSERVE_MIN_INTERVAL_MS) {
    return { recorded: false, reason: 'throttled' as const };
  }
  const snapshot = await recordSnapshot(post.id, metrics, 'EXTENSION');
  return snapshot
    ? { recorded: true as const, snapshotId: snapshot.id }
    : { recorded: false, reason: 'no-metrics' as const };
}

export type SortKey = 'tracked' | 'published' | 'likes' | 'comments' | 'shares' | 'views';
export interface ListOptions {
  q?: string;
  platform?: Platform;
  status?: TrackingStatus;
  sort?: SortKey;
  dir?: 'asc' | 'desc';
  take?: number;
  skip?: number;
}

const SORT_FIELDS: Record<SortKey, keyof Prisma.PostOrderByWithRelationInput> = {
  tracked: 'trackedAt',
  published: 'publishedAt',
  likes: 'latestLikes',
  comments: 'latestComments',
  shares: 'latestShares',
  views: 'latestViews',
};

export async function listPosts(opts: ListOptions = {}) {
  const q = opts.q?.trim();
  const where: Prisma.PostWhereInput = {
    platform: opts.platform,
    status: opts.status,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { contentPreview: { contains: q, mode: 'insensitive' } },
            { authorName: { contains: q, mode: 'insensitive' } },
            { community: { contains: q, mode: 'insensitive' } },
            { canonicalUrl: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const field = SORT_FIELDS[opts.sort ?? 'tracked'];
  const dir = opts.dir ?? 'desc';
  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      // Unavailable metrics always sort last so they are never confused with low engagement.
      orderBy: [
        field === 'trackedAt' ? { trackedAt: dir } : { [field]: { sort: dir, nulls: 'last' } },
        { trackedAt: 'desc' },
      ],
      take: opts.take ?? 50,
      skip: opts.skip ?? 0,
      include: {
        snapshots: { orderBy: { capturedAt: 'desc' }, take: 2 },
        _count: { select: { snapshots: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);
  return { items, total };
}

export async function getPost(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: { snapshots: { orderBy: { capturedAt: 'asc' } } },
  });
}

export async function setStatus(id: string, status: TrackingStatus) {
  return prisma.post.update({
    where: { id },
    data: {
      status,
      ...(status === 'ACTIVE'
        ? { nextCollectAt: new Date(), consecutiveFailures: 0, lastError: null }
        : {}),
    },
  });
}

export async function deletePost(id: string) {
  await prisma.post.delete({ where: { id } });
}

export async function overviewStats() {
  const dayAgo = new Date(Date.now() - 24 * HOUR);
  const [total, byPlatform, byStatus, snapshots24h, recent] = await Promise.all([
    prisma.post.count(),
    prisma.post.groupBy({ by: ['platform'], _count: { _all: true } }),
    prisma.post.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.snapshot.count({ where: { capturedAt: { gte: dayAgo } } }),
    prisma.post.findMany({
      orderBy: { trackedAt: 'desc' },
      take: 6,
      include: { snapshots: { orderBy: { capturedAt: 'desc' }, take: 2 } },
    }),
  ]);
  return {
    total,
    byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r._count._all])) as Partial<
      Record<Platform, number>
    >,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Partial<
      Record<TrackingStatus, number>
    >,
    snapshots24h,
    recent,
  };
}

/** Posts whose growth over the last `windowMs` is largest (by likes, then comments). */
export async function topMovers(windowMs = 24 * HOUR, take = 5) {
  const since = new Date(Date.now() - windowMs);
  const posts = await prisma.post.findMany({
    where: { snapshots: { some: { capturedAt: { gte: since } } } },
    include: { snapshots: { orderBy: { capturedAt: 'asc' } } },
    take: 200,
  });
  return posts
    .map((post) => {
      const inWindow = post.snapshots.filter((s) => s.capturedAt >= since);
      const before = post.snapshots.filter((s) => s.capturedAt < since).at(-1) ?? inWindow[0];
      const after = inWindow.at(-1);
      const delta =
        before && after && before.id !== after.id && before.likes !== null && after.likes !== null
          ? after.likes - before.likes
          : null;
      return { post, delta };
    })
    .filter(
      (r): r is { post: (typeof posts)[number]; delta: number } =>
        r.delta !== null && r.delta !== 0,
    )
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, take);
}
