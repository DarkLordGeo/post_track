import { deletePost, getPost, setStatus } from '@post-tracker/db';
import { errorResponse, json, parseBody, preflight } from '@/lib/http';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const post = await getPost((await params).id);
  return post ? json(post) : errorResponse(404, 'Post not found');
}

const patchSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED']) });

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;
  try {
    return json(await setStatus((await params).id, body.data.status));
  } catch {
    return errorResponse(404, 'Post not found');
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await deletePost((await params).id);
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse(404, 'Post not found');
  }
}
