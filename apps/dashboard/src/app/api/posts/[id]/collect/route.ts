import { prisma } from '@post-tracker/db';
import { collectDue } from '@/server/collector';
import { errorResponse, json, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Collect a fresh snapshot for one post right now, outside its schedule. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.post.count({ where: { id } });
  if (!exists) return errorResponse(404, 'Post not found');
  return json(await collectDue({ postIds: [id] }));
}
