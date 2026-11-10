import { db, expect, resetDb, test } from './fixtures';

/**
 * X and LinkedIn need a logged-in session, so these tests serve synthetic pages (modelled on
 * each site's DOM) on the real hostnames. That exercises the real content scripts, injector,
 * background worker and API end-to-end without credentials.
 */
test.beforeEach(resetDb);

const X_PAGE = `<!doctype html><html><body><main>
<article data-testid="tweet">
  <div data-testid="User-Name"><a href="/NASA"><span>NASA</span></a>
    <a href="/NASA/status/1850553412046295193"><time datetime="2024-10-27T15:00:00.000Z">Oct 27</time></a></div>
  <div data-testid="tweetText">Synthetic test tweet</div>
  <div role="group">
    <button data-testid="reply" aria-label="45 Replies. Reply"></button>
    <button data-testid="retweet" aria-label="1,203 reposts. Repost"></button>
    <button data-testid="like" aria-label="9,876 Likes. Like"></button>
    <a href="/NASA/status/1850553412046295193/analytics" aria-label="250,000 views. View post analytics"></a>
  </div>
</article></main></body></html>`;

const LI_PAGE = `<!doctype html><html><body><main>
<div data-urn="urn:li:activity:7262900123456789504">
  <span class="update-components-actor__title"><span aria-hidden="true">Jane Doe</span></span>
  <div class="update-components-text">Synthetic LinkedIn post</div>
  <span class="social-details-social-counts__reactions-count">1,204</span>
  <button class="social-details-social-counts__comments" aria-label="87 comments">87 comments</button>
  <div class="feed-shared-social-action-bar"><button>Like</button></div>
</div></main></body></html>`;

for (const [name, url, html, platform, id, likes] of [
  ['X', 'https://x.com/NASA/status/1850553412046295193', X_PAGE, 'X', '1850553412046295193', 9876],
  [
    'LinkedIn',
    'https://www.linkedin.com/feed/update/urn:li:activity:7262900123456789504/',
    LI_PAGE,
    'LINKEDIN',
    '7262900123456789504',
    1204,
  ],
] as const) {
  test(`tracks a ${name} post through the extension`, async ({ context, worker: _w }) => {
    await context.route(url, (route) => route.fulfill({ contentType: 'text/html', body: html }));
    const page = await context.newPage();
    await page.goto(url);
    const button = page.locator('post-tracker-action button');
    await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
    await button.click();
    await expect(button).toHaveAttribute('data-state', 'tracked');
    const saved = await db.post.findUniqueOrThrow({
      where: { platform_platformPostId: { platform, platformPostId: id } },
    });
    expect(saved.latestLikes).toBe(likes);
    await page.reload();
    await expect(page.locator('post-tracker-action button')).toHaveAttribute(
      'data-state',
      'tracked',
      { timeout: 15_000 },
    );
  });
}

test('revisiting a tracked post records a fresh snapshot (after the throttle window)', async ({
  context,
  worker: _w,
}) => {
  const url = 'https://x.com/NASA/status/1850553412046295193';
  await context.route(url, (route) => route.fulfill({ contentType: 'text/html', body: X_PAGE }));
  const page = await context.newPage();
  await page.goto(url);
  const button = page.locator('post-tracker-action button');
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
  await button.click();
  await expect(button).toHaveAttribute('data-state', 'tracked');
  expect(await db.snapshot.count()).toBe(1);

  // Within 15 minutes: throttled, nothing recorded.
  await page.reload();
  await expect(page.locator('post-tracker-action button')).toHaveAttribute(
    'data-state',
    'tracked',
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);
  expect(await db.snapshot.count()).toBe(1);

  // Age the snapshot past the window and revisit.
  await db.snapshot.updateMany({ data: { capturedAt: new Date(Date.now() - 3600_000) } });
  await page.reload();
  await expect.poll(() => db.snapshot.count(), { timeout: 10_000 }).toBe(2);
});

/** LinkedIn's current UI (observed 2026-11-11): no post id in the card; id only in the menu. */
const LI_CURRENT = `<!doctype html><html><body><main><div role="list">
<div role="listitem" componentkey="update-card-focusABC">
  <a aria-label="View company: Microsoft" href="https://www.linkedin.com/company/microsoft/">Microsoft</a>
  <button aria-label="Open control menu for post by Microsoft"></button>
  <p><span data-testid="expandable-text-box">Synthetic current-UI LinkedIn post</span></p>
  <div><span>88 reactions</span></div>
  <div><div><button aria-label="Comment"></button><button aria-label="Repost"></button></div><button aria-label="Send"></button></div>
</div></div>
<script>
  document.querySelector('[aria-label^="Open control menu"]').addEventListener('click', () => {
    const open = document.querySelector('[role="menu"]');
    if (open) return open.remove();
    document.body.insertAdjacentHTML('beforeend', '<div role="menu"><a href="https://www.linkedin.com/preload/embed-modal/?targetUrn=urn%3Ali%3Ashare%3A7525983002573000000">Embed this post</a></div>');
  });
</script></main></body></html>`;

test('LinkedIn current UI: resolves the post id on click, then tracks it', async ({
  context,
  worker: _w,
}) => {
  const url = 'https://www.linkedin.com/company/microsoft/posts/';
  await context.route(url, (route) =>
    route.fulfill({ contentType: 'text/html', body: LI_CURRENT }),
  );
  const page = await context.newPage();
  await page.goto(url);
  const button = page.locator('post-tracker-action button');
  await expect(button).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
  await button.click();
  await expect(button).toHaveAttribute('data-state', 'tracked');
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  const saved = await db.post.findUniqueOrThrow({
    where: {
      platform_platformPostId: {
        platform: 'LINKEDIN',
        platformPostId: 'share:7525983002573000000',
      },
    },
  });
  expect(saved).toMatchObject({ authorName: 'Microsoft', latestLikes: 88, latestComments: null });

  // Clicking Track on the same post after a reload resolves it again and reports a duplicate.
  await page.reload();
  const again = page.locator('post-tracker-action button');
  await expect(again).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
  await again.click();
  await expect(again).toHaveAttribute('data-state', 'tracked');
  expect(await db.post.count()).toBe(1);
});
