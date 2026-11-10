import { expect, test, type Page } from '@playwright/test';
import { db } from './fixtures';
import { seedMixedPlatforms } from './seed';

const WIDTHS = [1920, 1440, 1280, 1024, 768, 390, 360];

let pages: string[] = [];
test.beforeAll(async () => {
  const { reddit, long } = await seedMixedPlatforms();
  const collection = await db.collection.create({
    data: {
      name: `Responsive audit ${'with-a-very-long-collection-name'.repeat(2)}`,
      posts: { create: (await db.post.findMany()).map((p) => ({ postId: p.id })) },
    },
  });
  await db.collection.create({ data: { name: 'Empty' } });
  pages = [
    '/',
    '/posts',
    `/posts/${reddit.id}`,
    `/posts/${long.id}`,
    '/collections',
    `/collections/${collection.id}`,
    '/extension',
  ];
});

/** Elements that stick out past the right edge of the viewport (for readable failures). */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const width = doc.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= width + 1) return false;
        // Ignore content inside an intentional horizontal scroller.
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return false;
        }
        return true;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(el.getBoundingClientRect().right)}px`);
    return { scroll: doc.scrollWidth - width, offenders };
  });
}

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const result = await overflow(page);
      expect.soft(result, `${path} at ${width}px`).toEqual({ scroll: 0, offenders: [] });
      if (process.env.SHOTS) {
        await page.screenshot({
          path: `${process.env.SHOTS}/${width}${path.replace(/\//g, '_').replace(/_([a-z0-9]{20,})/, '_detail')}.png`,
          fullPage: true,
        });
      }
    }
  });
}

test('mobile uses the bottom tab bar, desktop the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const navs = page.getByRole('navigation', { name: 'Main' });
  await expect(navs.filter({ visible: true })).toHaveCount(1);
  const bottom = navs.filter({ visible: true });
  const box = (await bottom.boundingBox())!;
  expect(box.y + box.height).toBeCloseTo(800, 0);
  await bottom.getByRole('link', { name: 'Collections' }).click();
  await expect(page).toHaveURL(/\/collections$/);
  // Page content is not hidden behind the fixed bar.
  const mainPad = await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).paddingBottom));
  expect(mainPad).toBeGreaterThanOrEqual(box.height - 1);

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(navs.filter({ visible: true })).toHaveCount(1);
  const side = (await navs.filter({ visible: true }).boundingBox())!;
  expect(side.x).toBeLessThan(240);
  expect(side.y).toBeLessThan(200);
});

test('dialogs fit a 360px screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  const c = await db.collection.findFirstOrThrow({ where: { name: { startsWith: 'Responsive' } } });
  await page.goto(`/collections/${c.id}`);
  await page.getByRole('button', { name: 'Add posts' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add posts' });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400); // let the entrance animation finish before measuring
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
});

test.describe('touch devices', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } });

  test('primary controls meet a 40px touch target', async ({ page }) => {
    await page.goto('/posts');
    const targets = [
      page.getByRole('searchbox', { name: 'Search posts' }),
      page.getByLabel('Sort by'),
      page.getByRole('tab', { name: /^All/ }),
      page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link').first(),
      page.getByRole('button', { name: 'Toggle theme' }),
    ];
    for (const t of targets) {
      const box = (await t.boundingBox())!;
      expect.soft(box.height, await t.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(40);
    }
  });
});
