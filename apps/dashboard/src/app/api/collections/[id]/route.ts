import {
  CollectionNameTakenError,
  deleteCollection,
  getCollection,
  updateCollection,
} from '@post-tracker/db';
import { updateCollectionSchema } from '@/lib/collections';
import { errorResponse, json, parseBody, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const collection = await getCollection((await params).id);
  return collection ? json(collection) : errorResponse(404, 'Collection not found');
}

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await parseBody(req, updateCollectionSchema);
  if (!body.ok) return body.response;
  try {
    const updated = await updateCollection((await params).id, body.data);
    return updated ? json(updated) : errorResponse(404, 'Collection not found');
  } catch (err) {
    if (err instanceof CollectionNameTakenError) return errorResponse(409, err.message);
    throw err;
  }
}

/** Deletes the collection only; its posts stay tracked. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const deleted = await deleteCollection((await params).id);
  return deleted ? new Response(null, { status: 204 }) : errorResponse(404, 'Collection not found');
}
