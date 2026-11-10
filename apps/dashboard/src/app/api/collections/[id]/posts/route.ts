import { addPostsToCollection, getCollection } from '@post-tracker/db';
import { addPostsSchema } from '@/lib/collections';
import { errorResponse, json, parseBody, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Add tracked posts to a collection. Posts already in it are ignored. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await parseBody(req, addPostsSchema);
  if (!body.ok) return body.response;
  const { id } = await params;
  if (!(await getCollection(id))) return errorResponse(404, 'Collection not found');
  return json(await addPostsToCollection(id, body.data.postIds));
}
