import type { Platform } from '@prisma/client';
import { db, resetDb } from './fixtures';

const HOUR = 3600_000;

/** Three posts (one per platform) with snapshot history, plus a long-text post. */
export async function seedMixedPlatforms() {
  await resetDb();
  const now = Date.now();
  const make = (platform: Platform, platformPostId: string, title: string, likes: number[]) =>
    db.post.create({
      data: {
        platform,
        platformPostId,
        canonicalUrl: `https://example.com/${platform.toLowerCase()}/${platformPostId}`,
        originalUrl: `https://example.com/${platform.toLowerCase()}/${platformPostId}`,
        title,
        authorName: `${platform.toLowerCase()} author`,
        trackedAt: new Date(now - 5 * HOUR),
        latestLikes: likes.at(-1),
        snapshots: {
          create: likes.map((n, i) => ({
            capturedAt: new Date(now - (likes.length - i) * HOUR),
            source: 'EXTENSION' as const,
            likes: n,
          })),
        },
      },
    });
  const reddit = await make('REDDIT', 'e2er1', 'E2E Reddit launch thread', [10, 40]);
  const x = await make('X', '1850553412046295193', 'E2E X announcement', [100, 250]);
  const linkedin = await make('LINKEDIN', '7262900123456789504', 'E2E LinkedIn company update', [5, 9]);
  const long = await db.post.create({
    data: {
      platform: 'REDDIT',
      platformPostId: 'e2elong',
      canonicalUrl: 'https://example.com/reddit/e2elong',
      originalUrl: 'https://example.com/reddit/e2elong',
      title: `E2E long ${'Supercalifragilisticexpialidocious'.repeat(4)} https://example.com/${'a'.repeat(120)}`,
      contentPreview: `Body with an unbroken URL https://example.com/${'b'.repeat(200)} and more text.`,
      community: `r/${'verylongsubredditname'.repeat(2)}`,
      authorName: 'x'.repeat(60),
      media: [{ type: 'link', url: `https://example.com/${'c'.repeat(150)}` }],
      latestLikes: 1,
      snapshots: { create: [{ source: 'EXTENSION', likes: 1, comments: 0 }] },
    },
  });
  return { reddit, x, linkedin, long };
}
