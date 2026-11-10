import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Platform, TrackPostInput } from '@post-tracker/core';
import {
  addPostsToCollection,
  CollectionNameTakenError,
  collectionsForPost,
  createCollection,
  deleteCollection,
  getCollection,
  listCollections,
  listPosts,
  prisma,
  recordSnapshot,
  removePostFromCollection,
  trackPost,
  updateCollection,
} from '../src';

const post = (platform: Platform, id: string): TrackPostInput => ({
  platform,
  platformPostId: id,
  canonicalUrl: `https://example.com/${platform}/${id}`,
  originalUrl: `https://example.com/${platform}/${id}`,
  authorName: null,
  authorHandle: null,
  authorUrl: null,
  title: `${platform} ${id}`,
  contentPreview: null,
  community: null,
  media: [],
  publishedAt: null,
  metrics: { likes: 1, comments: null, shares: null, views: null },
});

async function threePlatforms() {
  const reddit = (await trackPost(post('REDDIT', 'r1'))).post;
  const x = (await trackPost(post('X', '1234567890'))).post;
  const linkedin = (await trackPost(post('LINKEDIN', '7262900123456789504'))).post;
  return { reddit, x, linkedin };
}

beforeEach(async () => {
  await prisma.collectionPost.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.snapshot.deleteMany();
  await prisma.post.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('collections', () => {
  it('creates, renames and rejects duplicate names', async () => {
    const c = await createCollection({ name: 'Launch week' });
    await expect(createCollection({ name: 'Launch week' })).rejects.toBeInstanceOf(
      CollectionNameTakenError,
    );
    const renamed = await updateCollection(c.id, { name: 'Launch week 2026' });
    expect(renamed?.name).toBe('Launch week 2026');
    await createCollection({ name: 'Other' });
    await expect(updateCollection(c.id, { name: 'Other' })).rejects.toBeInstanceOf(
      CollectionNameTakenError,
    );
    expect(await updateCollection('missing', { name: 'x' })).toBeNull();
  });

  it('groups posts from Reddit, X and LinkedIn and counts them', async () => {
    const { reddit, x, linkedin } = await threePlatforms();
    const c = await createCollection({ name: 'Mixed' });
    expect(await addPostsToCollection(c.id, [reddit.id, x.id, linkedin.id, 'unknown-id'])).toEqual({
      added: 3,
    });
    // Re-adding is a no-op.
    expect(await addPostsToCollection(c.id, [reddit.id])).toEqual({ added: 0 });
    const [listed] = await listCollections();
    expect(listed).toMatchObject({ name: 'Mixed', postCount: 3 });
    expect([...listed!.platforms].sort()).toEqual(['LINKEDIN', 'REDDIT', 'X']);
    expect((await getCollection(c.id))?.postCount).toBe(3);
  });

  it('lets one post belong to several collections and filters the post list', async () => {
    const { reddit, x } = await threePlatforms();
    const a = await createCollection({ name: 'A' });
    const b = await createCollection({ name: 'B' });
    await addPostsToCollection(a.id, [reddit.id, x.id]);
    await addPostsToCollection(b.id, [reddit.id]);
    expect((await collectionsForPost(reddit.id)).map((c) => c.name)).toEqual(['A', 'B']);
    expect((await listPosts({ collectionId: b.id })).items.map((p) => p.id)).toEqual([reddit.id]);
    expect((await listPosts({ collectionId: a.id, platform: 'X' })).items.map((p) => p.id)).toEqual(
      [x.id],
    );
  });

  it('removing a post from a collection keeps the post and its history', async () => {
    const { reddit } = await threePlatforms();
    await recordSnapshot(
      reddit.id,
      { likes: 5, comments: 1, shares: null, views: null },
      'COLLECTOR',
    );
    const c = await createCollection({ name: 'C' });
    await addPostsToCollection(c.id, [reddit.id]);
    expect(await removePostFromCollection(c.id, reddit.id)).toBe(true);
    expect(await removePostFromCollection(c.id, reddit.id)).toBe(false);
    expect(await prisma.post.count({ where: { id: reddit.id } })).toBe(1);
    expect(await prisma.snapshot.count({ where: { postId: reddit.id } })).toBe(2);
  });

  it('deleting a collection keeps its posts; deleting a post drops its memberships', async () => {
    const { reddit, x } = await threePlatforms();
    const c = await createCollection({ name: 'Temp' });
    await addPostsToCollection(c.id, [reddit.id, x.id]);
    expect(await deleteCollection(c.id)).toBe(true);
    expect(await deleteCollection(c.id)).toBe(false);
    expect(await prisma.post.count()).toBe(3);
    expect(await prisma.snapshot.count()).toBe(3);

    const d = await createCollection({ name: 'Keep' });
    await addPostsToCollection(d.id, [reddit.id, x.id]);
    await prisma.post.delete({ where: { id: x.id } });
    expect((await getCollection(d.id))?.postCount).toBe(1);
  });
});
