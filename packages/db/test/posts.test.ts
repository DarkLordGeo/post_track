import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { TrackPostInput } from '@post-tracker/core';
import {
  collectionInterval,
  getPost,
  listPosts,
  lookupTracked,
  observePost,
  prisma,
  recordSnapshot,
  trackPost,
} from '../src';

const base: TrackPostInput = {
  platform: 'REDDIT',
  platformPostId: 'abc123',
  canonicalUrl: 'https://www.reddit.com/r/rust/comments/abc123/',
  originalUrl: 'https://www.reddit.com/r/rust/comments/abc123/hello/',
  authorName: 'ferris',
  authorHandle: 'u/ferris',
  authorUrl: 'https://www.reddit.com/user/ferris/',
  title: 'Hello Rust',
  contentPreview: null,
  community: 'r/rust',
  media: [],
  publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  metrics: { likes: 10, comments: 0, shares: null, views: null },
};

beforeEach(async () => {
  await prisma.snapshot.deleteMany();
  await prisma.post.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('trackPost', () => {
  it('creates a post with an initial snapshot that keeps null ≠ 0', async () => {
    const { post, created } = await trackPost(base);
    expect(created).toBe(true);
    const full = await getPost(post.id);
    expect(full!.snapshots).toHaveLength(1);
    expect(full!.snapshots[0]).toMatchObject({
      likes: 10,
      comments: 0,
      shares: null,
      views: null,
      source: 'EXTENSION',
    });
    expect(full!.latestComments).toBe(0);
    expect(full!.latestShares).toBeNull();
    expect(full!.nextCollectAt).not.toBeNull();
  });

  it('deduplicates by platform + id and backfills missing fields only', async () => {
    const first = await trackPost(base);
    const again = await trackPost({
      ...base,
      title: 'Changed',
      contentPreview: 'Body text',
      originalUrl: 'https://redd.it/abc123',
    });
    expect(again.created).toBe(false);
    expect(again.post.id).toBe(first.post.id);
    expect(again.post.title).toBe('Hello Rust');
    expect(again.post.contentPreview).toBe('Body text');
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.snapshot.count()).toBe(1);
  });

  it('survives concurrent duplicate track requests', async () => {
    const results = await Promise.all([trackPost(base), trackPost(base), trackPost(base)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.post.id)).size).toBe(1);
  });

  it('does not create an empty snapshot when no metrics are available', async () => {
    const { post } = await trackPost({
      ...base,
      metrics: { likes: null, comments: null, shares: null, views: null },
    });
    expect((await getPost(post.id))!.snapshots).toHaveLength(0);
  });
});

describe('lookup + observe', () => {
  it('reports tracked posts by key', async () => {
    const { post } = await trackPost(base);
    const map = await lookupTracked([
      { platform: 'REDDIT', platformPostId: 'abc123' },
      { platform: 'REDDIT', platformPostId: 'zzz999' },
    ]);
    expect(map).toEqual({ 'REDDIT:abc123': post.id });
  });

  it('throttles extension observations', async () => {
    const { post } = await trackPost(base);
    const m = { likes: 20, comments: 3, shares: null, views: null };
    expect(await observePost('REDDIT', 'abc123', m)).toMatchObject({
      recorded: false,
      reason: 'throttled',
    });
    await prisma.snapshot.updateMany({ data: { capturedAt: new Date(Date.now() - 3600_000) } });
    expect(await observePost('REDDIT', 'abc123', m)).toMatchObject({ recorded: true });
    expect((await getPost(post.id))!.latestLikes).toBe(20);
    expect(await observePost('REDDIT', 'nope', m)).toMatchObject({ reason: 'not-tracked' });
  });
});

describe('listPosts', () => {
  it('searches, filters and sorts with unavailable metrics last', async () => {
    const a = await trackPost(base);
    const b = await trackPost({
      ...base,
      platformPostId: 'def456',
      title: 'Zig news',
      metrics: { likes: 99, comments: 1, shares: null, views: null },
    });
    const c = await trackPost({
      ...base,
      platformPostId: 'ghi789',
      title: 'No metrics',
      metrics: { likes: null, comments: null, shares: null, views: null },
    });
    const byLikes = await listPosts({ sort: 'likes', dir: 'desc' });
    expect(byLikes.items.map((p) => p.id)).toEqual([b.post.id, a.post.id, c.post.id]);
    const asc = await listPosts({ sort: 'likes', dir: 'asc' });
    expect(asc.items.at(-1)!.id).toBe(c.post.id);
    expect((await listPosts({ q: 'zig' })).items.map((p) => p.id)).toEqual([b.post.id]);
    expect((await listPosts({ platform: 'X' })).total).toBe(0);
  });

  it('recordSnapshot ignores all-null metrics', async () => {
    const { post } = await trackPost(base);
    expect(
      await recordSnapshot(
        post.id,
        { likes: null, comments: null, shares: null, views: null },
        'COLLECTOR',
      ),
    ).toBeNull();
  });
});

describe('collectionInterval', () => {
  it('samples young posts more often', () => {
    const now = new Date();
    expect(collectionInterval(new Date(now.getTime() - 3600_000), now)).toBe(3600_000);
    expect(collectionInterval(new Date(now.getTime() - 3 * 86400_000), now)).toBe(6 * 3600_000);
    expect(collectionInterval(null, now)).toBe(24 * 3600_000);
  });
});
