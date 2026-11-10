import { CollectionNameTakenError, createCollection, listCollections } from '@post-tracker/db';
import { createCollectionSchema } from '@/lib/collections';
import { errorResponse, json, parseBody, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

export async function GET() {
  return json({ items: await listCollections() });
}

export async function POST(req: Request) {
  const body = await parseBody(req, createCollectionSchema);
  if (!body.ok) return body.response;
  try {
    return json(await createCollection(body.data), { status: 201 });
  } catch (err) {
    if (err instanceof CollectionNameTakenError) return errorResponse(409, err.message);
    throw err;
  }
}
