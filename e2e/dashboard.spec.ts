import { test as base, expect } from '@playwright/test';
import { API, db, resetDb } from './fixtures';

const test = base;
const HOUR = 3600_000;

async function seed() {
  await resetDb();
  const now = Date.now();
  const rust = await db.post.create({
    data: {
      platform: 'REDDIT',
      platformPostId: 'e2erust',
      canonicalUrl: 'https://www.reddit.com/r/rust/comments/e2erust/',
      originalUrl: 'https://www.reddit.com/r/rust/comments/e2erust/test/',
      authorName: 'ferris',
      authorHandle: 'u/ferris',
      authorUrl: 'https://www.reddit.com/user/ferris/',
      title: 'E2E: Rust borrow checker explained',
      contentPreview: 'A long explanation of lifetimes.',
      community: 'r/rust',
      publishedAt: new Date(now - 30 * HOUR),
      trackedAt: new Date(now - 28 * HOUR),
      latestLikes: 140,
      latestComments: 0,
      snapshots: {
        create: [
          { capturedAt: new Date(now - 28 * HOUR), source: 'EXTENSION', likes: 40, comments: 0 },
          { capturedAt: new Date(now - 20 * HOUR), source: 'COLLECTOR', likes: 90, comments: 0 },
          { capturedAt: new Date(now - 2 * HOUR), source: 'COLLECTOR', likes: 140, comments: 0 },
        ],
      },
    },
  });
  await db.post.create({
    data: {
      platform: 'REDDIT',
      platformPostId: 'e2ezig',
      canonicalUrl: 'https://www.reddit.com/r/zig/comments/e2ezig/',
      originalUrl: 'https://www.reddit.com/r/zig/comments/e2ezig/',
      title: 'E2E: Zig comptime tricks',
      community: 'r/zig',
      trackedAt: new Date(now - HOUR),
    },
  });
  return { rust };
}

test.beforeEach(async () => {
  await seed();
});

test('lists, searches and filters tracked posts', async ({ page }) => {
  await page.goto('/posts');
  await expect(page.getByRole('heading', { name: 'Tracked posts' })).toBeVisible();
  await expect(page.getByText('E2E: Rust borrow checker explained')).toBeVisible();
  await expect(page.getByText('E2E: Zig comptime tricks')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search posts' }).fill('zig');
  await expect(page).toHaveURL(/q=zig/);
  await expect(page.getByText('E2E: Rust borrow checker explained')).toHaveCount(0);
  await expect(page.getByText('E2E: Zig comptime tricks')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search posts' }).fill('');
  await page.getByRole('tab', { name: /^X/ }).click();
  await expect(page.getByText('No posts match')).toBeVisible();
});

test('sorts by likes with unavailable metrics last', async ({ page }) => {
  await page.goto('/posts?sort=likes&dir=asc');
  const titles = page.locator('ul li p.truncate');
  await expect(titles.first()).toHaveText('E2E: Rust borrow checker explained');
  await expect(titles.last()).toHaveText('E2E: Zig comptime tricks');
});

test('post detail shows metrics, history and distinguishes zero from unavailable', async ({
  page,
}) => {
  const { rust } = await seed();
  await page.goto(`/posts/${rust.id}`);
  await expect(
    page.getByRole('heading', { name: 'E2E: Rust borrow checker explained' }),
  ).toBeVisible();
  await expect(page.getByText('+100').first()).toBeVisible(); // 40 → 140
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
  // Comments observed as 0, shares/views unavailable on Reddit.
  await expect(page.getByText('Not provided by Reddit')).toHaveCount(2);
  await expect(page.locator('table tbody tr')).toHaveCount(3);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused').first()).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('Tracking').first()).toBeVisible();

  // Without Reddit credentials, collection explains why it is skipped.
  await page.getByRole('button', { name: 'Collect now' }).click();
  await expect(page.getByRole('status')).toContainText('Reddit API credentials');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/posts$/);
  expect(await db.post.count()).toBe(1);
});

test('overview summarises the collection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Tracked posts').first()).toBeVisible();
  await expect(page.getByText('E2E: Rust borrow checker explained').first()).toBeVisible();
  await expect(page.getByText('Top movers · 24h')).toBeVisible();
});

test('API validates input and is idempotent', async ({ request }) => {
  const bad = await request.post(`${API}/api/posts`, { data: { platform: 'REDDIT' } });
  expect(bad.status()).toBe(422);
  const body = {
    platform: 'REDDIT',
    platformPostId: 'e2eapi',
    canonicalUrl: 'https://www.reddit.com/comments/e2eapi/',
    originalUrl: 'https://www.reddit.com/comments/e2eapi/',
    authorName: null,
    authorHandle: null,
    authorUrl: null,
    title: 'API',
    contentPreview: null,
    community: null,
    media: [],
    publishedAt: null,
    metrics: { likes: 1, comments: null, shares: null, views: null },
  };
  const first = await request.post(`${API}/api/posts`, { data: body });
  expect(first.status()).toBe(201);
  const second = await request.post(`${API}/api/posts`, { data: body });
  expect(second.status()).toBe(200);
  expect((await second.json()).created).toBe(false);
  const lookup = await request.post(`${API}/api/posts/lookup`, {
    data: { posts: [{ platform: 'REDDIT', platformPostId: 'e2eapi' }] },
  });
  expect(Object.keys((await lookup.json()).tracked)).toEqual(['REDDIT:e2eapi']);
});
