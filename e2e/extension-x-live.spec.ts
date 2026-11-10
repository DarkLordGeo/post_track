import { db, expect, resetDb, test } from './fixtures';

/**
 * Live x.com check (logged-out view). X serves an empty page to headless browsers, so this
 * runs only on demand with a display: `LIVE_X=1 HEADED=1 pnpm exec playwright test extension-x-live`.
 */
test.skip(!process.env.LIVE_X, 'set LIVE_X=1 (and HEADED=1) to run against live x.com');
test.beforeEach(resetDb);

test('tracks a live X post from a profile timeline', async ({ context, worker: _w }) => {
  const page = await context.newPage();
  await page.goto('https://x.com/NASA', { waitUntil: 'domcontentloaded' });
  const first = page.locator('article').first();
  const button = first.locator('post-tracker-action button');
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 30_000 });
  // The button must sit in the post's action bar, not inside a video player.
  await expect(first.locator('[role="group"] post-tracker-action')).toHaveCount(1);
  const label = await first
    .locator('[role="group"]:has(post-tracker-action)')
    .getAttribute('aria-label');
  await button.click();
  await expect(button).toHaveAttribute('data-state', 'tracked');
  const saved = await db.post.findFirstOrThrow({ where: { platform: 'X' } });
  expect(saved.authorHandle).toBe('@NASA');
  expect(saved.publishedAt).not.toBeNull();
  expect(label).toContain(`${saved.latestLikes} likes`);
  expect(page.url()).toBe('https://x.com/NASA');
});
