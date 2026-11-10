import { removePostFromCollection } from '@post-tracker/db';
import { errorResponse, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Remove a post from the collection. The tracked post and its history are kept. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
) {
  const { id, postId } = await params;
  const removed = await removePostFromCollection(id, postId);
  return removed
    ? new Response(null, { status: 204 })
    : errorResponse(404, 'Post is not in this collection');
}
