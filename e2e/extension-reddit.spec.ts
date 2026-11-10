import { db, expect, resetDb, test } from './fixtures';

/**
 * Live test against reddit.com: requires network access. Skip with SKIP_LIVE=1.
 */
test.skip(!!process.env.SKIP_LIVE, 'live Reddit tests disabled');

test.beforeEach(resetDb);

const buttonIn = (page: import('@playwright/test').Page, scope: string) =>
  page.locator(`${scope} post-tracker-action`).first().locator('button');

test('tracks a Reddit post from its page, detects duplicates and stores metadata', async ({
  context,
  worker,
}) => {
  expect(worker.url()).toContain('chrome-extension://');
  const page = await context.newPage();
  await page.goto('https://www.reddit.com/r/programming/top/?t=week', {
    waitUntil: 'domcontentloaded',
  });
  const permalink = await page.locator('shreddit-post').first().getAttribute('permalink');
  expect(permalink).toBeTruthy();

  await page.goto(`https://www.reddit.com${permalink}`, { waitUntil: 'domcontentloaded' });
  const post = page.locator('shreddit-post').first();
  const postId = (await post.getAttribute('id'))!.replace('t3_', '');
  const button = buttonIn(page, 'shreddit-post');
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 20_000 });
  await expect(button).toHaveText('Track');

  await button.click();
  await expect(button).toHaveAttribute('data-state', 'tracked');
  await expect(page.locator('post-tracker-toasts')).toBeAttached();
  // Clicking must not navigate away from the post.
  expect(page.url()).toContain(postId);

  const saved = await db.post.findUniqueOrThrow({
    where: { platform_platformPostId: { platform: 'REDDIT', platformPostId: postId } },
    include: { snapshots: true },
  });
  expect(saved.canonicalUrl).toMatch(new RegExp(`/comments/${postId}/$`));
  expect(saved.title).toBe(await post.getAttribute('post-title'));
  expect(saved.authorName).toBe(await post.getAttribute('author'));
  expect(saved.publishedAt).not.toBeNull();
  expect(saved.latestLikes).toBe(Number(await post.getAttribute('score')));
  expect(saved.latestShares).toBeNull();
  expect(saved.latestViews).toBeNull();
  expect(saved.snapshots).toHaveLength(1);

  // Reload: the extension recognises the post as already tracked.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(buttonIn(page, 'shreddit-post')).toHaveAttribute('data-state', 'tracked', {
    timeout: 20_000,
  });
  expect(await db.post.count()).toBe(1);
});

test('injects one button per post in a subreddit feed', async ({ context, worker: _w }) => {
  const page = await context.newPage();
  await page.goto('https://www.reddit.com/r/programming/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('shreddit-post post-tracker-action').first()).toBeAttached({
    timeout: 20_000,
  });
  const posts = await page.locator('shreddit-post').count();
  const buttons = await page.locator('shreddit-post post-tracker-action').count();
  expect(posts).toBeGreaterThan(1);
  expect(buttons).toBe(posts);

  // Track from the feed without leaving the page.
  const url = page.url();
  const second = page.locator('shreddit-post').nth(1);
  await second.locator('post-tracker-action button').click();
  await expect(second.locator('post-tracker-action button')).toHaveAttribute(
    'data-state',
    'tracked',
  );
  expect(page.url()).toBe(url);
  expect(await db.post.count()).toBe(1);
});

test('shows a clear error when the dashboard is unreachable', async ({ context, worker }) => {
  await worker.evaluate(() => chrome.storage.local.set({ apiBase: 'http://localhost:3999' }));
  const page = await context.newPage();
  await page.goto('https://www.reddit.com/r/programming/top/?t=week', {
    waitUntil: 'domcontentloaded',
  });
  const button = buttonIn(page, 'shreddit-post');
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 20_000 });
  await button.click();
  await expect(button).toHaveAttribute('data-state', 'error');
  await expect(button).toHaveAttribute('title', /Can't reach Post Tracker/);
});
