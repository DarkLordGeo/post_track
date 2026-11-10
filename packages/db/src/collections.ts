import type { Platform } from '@prisma/client';
import { prisma } from './client';

export class CollectionNameTakenError extends Error {
  constructor(name: string) {
    super(`A collection named “${name}” already exists`);
  }
}

const PLATFORM_ORDER: Platform[] = ['REDDIT', 'X', 'LINKEDIN'];
const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === 'P2002';
const isNotFound = (err: unknown) => (err as { code?: string }).code === 'P2025';

/** All collections with their post counts and the platforms they contain. */
export async function listCollections() {
  const [collections, platformRows] = await Promise.all([
    prisma.collection.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    }),
    prisma.$queryRaw<{ collectionId: string; platform: Platform }[]>`
      SELECT DISTINCT cp."collectionId", p."platform"
      FROM "CollectionPost" cp JOIN "Post" p ON p."id" = cp."postId"`,
  ]);
  const platforms = new Map<string, Platform[]>();
  for (const row of platformRows) {
    platforms.set(row.collectionId, [...(platforms.get(row.collectionId) ?? []), row.platform]);
  }
  return collections.map((c) => ({
    ...c,
    postCount: c._count.posts,
    platforms: PLATFORM_ORDER.filter((p) => platforms.get(c.id)?.includes(p)),
  }));
}

export async function getCollection(id: string) {
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });
  return collection ? { ...collection, postCount: collection._count.posts } : null;
}

export async function createCollection(input: { name: string; description?: string | null }) {
  try {
    return await prisma.collection.create({
      data: { name: input.name, description: input.description ?? null },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new CollectionNameTakenError(input.name);
    throw err;
  }
}

/** Returns null when the collection does not exist. */
export async function updateCollection(
  id: string,
  input: { name?: string; description?: string | null },
) {
  try {
    return await prisma.collection.update({ where: { id }, data: input });
  } catch (err) {
    if (isUniqueViolation(err)) throw new CollectionNameTakenError(input.name ?? '');
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Deletes the collection and its memberships; the tracked posts are untouched. */
export async function deleteCollection(id: string) {
  try {
    await prisma.collection.delete({ where: { id } });
    return true;
  } catch (err) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

/** Adds posts to a collection; already-present posts and unknown ids are ignored. */
export async function addPostsToCollection(collectionId: string, postIds: string[]) {
  const existing = await prisma.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true },
  });
  const result = await prisma.collectionPost.createMany({
    data: existing.map((p) => ({ collectionId, postId: p.id })),
    skipDuplicates: true,
  });
  return { added: result.count };
}

/** Removes a post from a collection without touching the post itself. */
export async function removePostFromCollection(collectionId: string, postId: string) {
  const result = await prisma.collectionPost.deleteMany({ where: { collectionId, postId } });
  return result.count > 0;
}

export async function collectionsForPost(postId: string) {
  const rows = await prisma.collectionPost.findMany({
    where: { postId },
    include: { collection: { select: { id: true, name: true } } },
    orderBy: { collection: { name: 'asc' } },
  });
  return rows.map((r) => r.collection);
}
