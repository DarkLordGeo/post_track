import { chromium, test as base, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

export const API = 'http://localhost:3100';
const EXT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../apps/extension/.output/chrome-mv3',
);

export const db = new PrismaClient({
  datasourceUrl:
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:54329/post_tracker_test',
});

export async function resetDb() {
  await db.snapshot.deleteMany();
  await db.post.deleteMany();
}

/** A Chromium context with the built extension loaded and pointed at the test dashboard. */
export const test = base.extend<{ context: BrowserContext; worker: Worker }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      viewport: { width: 1360, height: 900 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      locale: 'en-US',
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`,
        '--disable-blink-features=AutomationControlled',
      ],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await sw.evaluate((api) => chrome.storage.local.set({ apiBase: api }), API);
    await use(sw);
  },
});

export const expect = test.expect;
