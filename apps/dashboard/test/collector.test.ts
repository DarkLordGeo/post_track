import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma, trackPost } from '@post-tracker/db';
import type { TrackPostInput } from '@post-tracker/core';
import { collectDue, defaultFetchers } from '@/server/collector';
import { createRedditFetcher } from '@/server/collector/reddit';
import type { PlatformFetcher } from '@/server/collector/types';

const input = (id: string): TrackPostInput => ({
  platform: 'REDDIT',
  platformPostId: id,
  canonicalUrl: `https://www.reddit.com/comments/${id}/`,
  originalUrl: `https://www.reddit.com/comments/${id}/`,
  authorName: null,
  authorHandle: null,
  authorUrl: null,
  title: id,
  contentPreview: null,
  community: null,
  media: [],
  publishedAt: new Date(Date.now() - 3600_000).toISOString(),
  metrics: { likes: 1, comments: 0, shares: null, views: null },
});

const due = () => prisma.post.updateMany({ data: { nextCollectAt: new Date(Date.now() - 1000) } });

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function mockReddit(handler: (url: string) => Response) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('access_token')) return jsonResponse({ access_token: 'tok', expires_in: 3600 });
    return handler(u);
  });
}

beforeEach(async () => {
  await prisma.snapshot.deleteMany();
  await prisma.post.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('reddit fetcher', () => {
  it('is unsupported without credentials (never fabricates data)', async () => {
    const f = createRedditFetcher({ userAgent: 'test' });
    const r = await f.fetchBatch([{ id: 'x', platform: 'REDDIT', platformPostId: 'abc' }]);
    expect(r.kind).toBe('unsupported');
  });

  it('maps score/comments and reports removed or missing posts', async () => {
    const fetch = mockReddit(() =>
      jsonResponse({
        data: {
          children: [
            { kind: 't3', data: { id: 'aaa111', score: 50, num_comments: 4 } },
            {
              kind: 't3',
              data: { id: 'bbb222', score: 1, num_comments: 0, removed_by_category: 'moderator' },
            },
          ],
        },
      }),
    );
    const f = createRedditFetcher({
      clientId: 'id',
      clientSecret: 's',
      userAgent: 'test',
      fetch: fetch as typeof globalThis.fetch,
    });
    const r = await f.fetchBatch([
      { id: '1', platform: 'REDDIT', platformPostId: 'aaa111' },
      { id: '2', platform: 'REDDIT', platformPostId: 'bbb222' },
      { id: '3', platform: 'REDDIT', platformPostId: 'ccc333' },
    ]);
    expect(r.kind).toBe('results');
    if (r.kind !== 'results') return;
    expect(r.results.get('1')).toEqual({
      kind: 'ok',
      metrics: { likes: 50, comments: 4, shares: null, views: null },
    });
    expect(r.results.get('2')?.kind).toBe('gone');
    expect(r.results.get('3')?.kind).toBe('gone');
    expect(fetch.mock.calls[1]![0]).toContain('id=t3_aaa111,t3_bbb222,t3_ccc333');
  });

  it('turns HTTP 429 into a platform-wide backoff', async () => {
    const fetch = mockReddit(
      () => new Response('', { status: 429, headers: { 'x-ratelimit-reset': '120' } }),
    );
    const f = createRedditFetcher({
      clientId: 'id',
      clientSecret: 's',
      userAgent: 't',
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
    });
    expect(await f.fetchBatch([{ id: '1', platform: 'REDDIT', platformPostId: 'a' }])).toEqual({
      kind: 'rate-limited',
      retryAt: new Date(120_000),
    });
  });
});

describe('collectDue', () => {
  it('records collector snapshots and reschedules', async () => {
    const { post } = await trackPost(input('aaa111'));
    await due();
    const fetcher: PlatformFetcher = {
      platform: 'REDDIT',
      batchSize: 10,
      fetchBatch: async (t) => ({
        kind: 'results',
        results: new Map(
          t.map((x) => [
            x.id,
            { kind: 'ok', metrics: { likes: 9, comments: 2, shares: null, views: null } },
          ]),
        ),
      }),
    };
    const s = await collectDue({ fetchers: [fetcher] });
    expect(s).toMatchObject({ checked: 1, collected: 1 });
    const after = await prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: { snapshots: true },
    });
    expect(after.snapshots.map((x) => x.source).sort()).toEqual(['COLLECTOR', 'EXTENSION']);
    expect(after.latestLikes).toBe(9);
    expect(after.nextCollectAt!.getTime()).toBeGreaterThan(Date.now());
    // Not due anymore → nothing to do.
    expect((await collectDue({ fetchers: [fetcher] })).checked).toBe(0);
  });

  it('backs off on errors and marks gone posts unavailable', async () => {
    const a = (await trackPost(input('aaa111'))).post;
    const b = (await trackPost(input('bbb222'))).post;
    await due();
    const fetcher: PlatformFetcher = {
      platform: 'REDDIT',
      batchSize: 10,
      fetchBatch: async () => ({
        kind: 'results',
        results: new Map([
          [a.id, { kind: 'error', reason: 'HTTP 500' }],
          [b.id, { kind: 'gone', reason: 'Removed' }],
        ]),
      }),
    };
    const s = await collectDue({ fetchers: [fetcher] });
    expect(s).toMatchObject({ failed: 1, unavailable: 1 });
    const pa = await prisma.post.findUniqueOrThrow({ where: { id: a.id } });
    expect(pa).toMatchObject({ consecutiveFailures: 1, lastError: 'HTTP 500', status: 'ACTIVE' });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(
      'UNAVAILABLE',
    );
  });

  it('defers all remaining posts of a rate-limited platform', async () => {
    await trackPost(input('aaa111'));
    await trackPost(input('bbb222'));
    await due();
    const retryAt = new Date(Date.now() + 600_000);
    const fetcher: PlatformFetcher = {
      platform: 'REDDIT',
      batchSize: 1,
      fetchBatch: async () => ({ kind: 'rate-limited', retryAt }),
    };
    const s = await collectDue({ fetchers: [fetcher] });
    expect(s.rateLimited).toEqual(['REDDIT']);
    const posts = await prisma.post.findMany();
    expect(posts.every((p) => p.nextCollectAt!.getTime() === retryAt.getTime())).toBe(true);
  });

  it('skips platforms without server-side access and explains why', async () => {
    await trackPost(input('aaa111'));
    await due();
    const s = await collectDue({ fetchers: defaultFetchers({}) });
    expect(s).toMatchObject({ skipped: 1, collected: 0 });
    expect(s.notes[0]).toMatch(/credentials/);
    expect(await prisma.snapshot.count({ where: { source: 'COLLECTOR' } })).toBe(0);
  });
});
