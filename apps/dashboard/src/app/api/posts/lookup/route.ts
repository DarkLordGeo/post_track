import { lookupSchema, type LookupResponse } from '@post-tracker/core';
import { lookupTracked } from '@post-tracker/db';
import { json, parseBody, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Batch "is this tracked?" check used by the extension when it renders buttons. */
export async function POST(req: Request) {
  const body = await parseBody(req, lookupSchema);
  if (!body.ok) return body.response;
  const res: LookupResponse = { tracked: await lookupTracked(body.data.posts) };
  return json(res);
}
