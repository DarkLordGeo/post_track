import { collectionsForPost, prisma } from '@post-tracker/db';
import { errorResponse, json, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Collections a post belongs to. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await prisma.post.count({ where: { id } }))) return errorResponse(404, 'Post not found');
  return json({ items: await collectionsForPost(id) });
}
