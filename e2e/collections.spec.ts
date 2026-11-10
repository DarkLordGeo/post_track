import { expect, test } from '@playwright/test';
import { db } from './fixtures';
import { seedMixedPlatforms } from './seed';

test.beforeEach(async () => {
  await seedMixedPlatforms();
});

test('collection lifecycle with Reddit, X and LinkedIn posts', async ({ page }) => {
  await page.goto('/collections');
  await expect(page.getByText('No collections yet')).toBeVisible();

  // Create
  await page.getByRole('button', { name: 'New collection' }).click();
  const create = page.getByRole('dialog', { name: 'New collection' });
  await create.getByLabel('Name').fill('Launch coverage');
  await create.getByRole('button', { name: 'Create collection' }).click();
  await expect(page).toHaveURL(/\/collections\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { name: 'Launch coverage' })).toBeVisible();
  await expect(page.getByText('This collection is empty')).toBeVisible();

  // Add posts from three platforms
  await page.getByRole('button', { name: 'Add posts' }).click();
  const add = page.getByRole('dialog', { name: 'Add posts' });
  for (const title of ['E2E Reddit launch thread', 'E2E X announcement', 'E2E LinkedIn company update']) {
    await add.getByText(title).click();
  }
  await add.getByRole('button', { name: 'Add 3' }).click();
  await expect(add).toBeHidden();
  await expect(page.getByText('3 posts', { exact: true })).toBeVisible();
  for (const label of ['Reddit', 'X', 'LinkedIn']) {
    await expect(page.locator('main ul').getByRole('img', { name: label, exact: true }).first()).toBeVisible();
  }

  // Already-added posts are marked in the picker
  await page.getByRole('button', { name: 'Add posts' }).click();
  await expect(add.getByText('Added')).toHaveCount(3);
  await add.getByRole('button', { name: 'Cancel' }).click();

  // Platform filter inside the collection
  await page.getByRole('navigation', { name: 'Filter by platform' }).getByRole('link').nth(2).click();
  await expect(page.getByRole('link', { name: /E2E X announcement/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Reddit launch thread/ })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Filter by platform' }).getByRole('link').first().click();

  // Rename, including the duplicate-name error
  await db.collection.create({ data: { name: 'Taken' } });
  await page.getByRole('button', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename collection' });
  await rename.getByLabel('Name').fill('Taken');
  await rename.getByRole('button', { name: 'Save' }).click();
  await expect(rename.getByRole('alert')).toContainText('already exists');
  await rename.getByLabel('Name').fill('Launch week');
  await rename.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Launch week' })).toBeVisible();

  // Remove one post: it leaves the collection but stays tracked with its history
  await page.getByRole('button', { name: /Remove “E2E X announcement”/ }).click();
  await expect(page.getByText('2 posts', { exact: true })).toBeVisible();
  const x = await db.post.findFirstOrThrow({ where: { platform: 'X' }, include: { snapshots: true } });
  expect(x.snapshots).toHaveLength(2);

  // Collections list shows the count and platforms
  await page.goto('/collections');
  const card = page.getByRole('link', { name: /Launch week/ });
  await expect(card).toContainText('2');
  await expect(card.getByRole('img', { name: 'Reddit' })).toBeVisible();
  await expect(card.getByRole('img', { name: 'LinkedIn' })).toBeVisible();

  // Dashboard post list filtered by collection
  const collection = await db.collection.findFirstOrThrow({ where: { name: 'Launch week' } });
  await page.goto('/posts');
  await page.getByLabel('Filter by collection').selectOption(collection.id);
  await expect(page).toHaveURL(new RegExp(`collection=${collection.id}`));
  await expect(page.getByRole('link', { name: /E2E Reddit launch thread/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E X announcement/ })).toHaveCount(0);

  // Delete the collection: posts and snapshots remain
  await page.goto(`/collections/${collection.id}`);
  await page.getByRole('button', { name: 'Delete collection' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete collection' }).click();
  await expect(page).toHaveURL(/\/collections$/);
  expect(await db.collection.count({ where: { id: collection.id } })).toBe(0);
  expect(await db.post.count()).toBe(4);
  expect(await db.snapshot.count()).toBe(7);
});

test('a post can belong to several collections from its detail page', async ({ page }) => {
  const reddit = await db.post.findFirstOrThrow({ where: { platformPostId: 'e2er1' } });
  await db.collection.create({ data: { name: 'Alpha' } });
  await page.goto(`/posts/${reddit.id}`);
  await expect(page.getByText('Not in any collection yet.')).toBeVisible();

  await page.getByLabel('Add to collection').selectOption({ label: 'Alpha' });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const chips = page.getByRole('list', { name: 'Collections this post belongs to' });
  await expect(chips.getByRole('link', { name: 'Alpha' })).toBeVisible();

  // Create a second collection inline; the post is added to it immediately.
  await page.getByLabel('Add to collection').selectOption({ label: '+ New collection…' });
  const dialog = page.getByRole('dialog', { name: 'New collection' });
  await dialog.getByLabel('Name').fill('Beta');
  await dialog.getByRole('button', { name: 'Create collection' }).click();
  await expect(chips.getByRole('link', { name: 'Beta' })).toBeVisible();
  expect(await db.collectionPost.count({ where: { postId: reddit.id } })).toBe(2);

  await chips.getByRole('button', { name: 'Remove from Alpha' }).click();
  await expect(chips.getByRole('link', { name: 'Alpha' })).toHaveCount(0);
  expect(await db.post.count({ where: { id: reddit.id } })).toBe(1);
});

test('collections API validates input and reports missing resources', async ({ request }) => {
  expect((await request.post('/api/collections', { data: { name: '' } })).status()).toBe(422);
  expect((await request.post('/api/collections', { data: { name: 'x'.repeat(61) } })).status()).toBe(422);
  const created = await request.post('/api/collections', { data: { name: 'API' } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  expect((await request.post('/api/collections', { data: { name: 'API' } })).status()).toBe(409);
  expect((await request.patch(`/api/collections/${id}`, { data: {} })).status()).toBe(422);
  expect((await request.post(`/api/collections/${id}/posts`, { data: { postIds: [] } })).status()).toBe(422);
  expect((await request.post('/api/collections/missing/posts', { data: { postIds: ['a'] } })).status()).toBe(404);
  expect((await request.delete(`/api/collections/${id}/posts/not-a-member`)).status()).toBe(404);
  expect((await request.get('/api/collections/missing')).status()).toBe(404);
  const posts = await db.post.findMany({ select: { id: true } });
  const added = await request.post(`/api/collections/${id}/posts`, { data: { postIds: posts.map((p) => p.id) } });
  expect(await added.json()).toEqual({ added: 4 });
  const list = await (await request.get(`/api/posts?collection=${id}`)).json();
  expect(list.total).toBe(4);
  expect((await request.delete(`/api/collections/${id}`)).status()).toBe(204);
  expect((await request.delete(`/api/collections/${id}`)).status()).toBe(404);
  expect(await db.post.count()).toBe(4);
});
