import { observeSchema } from '@post-tracker/core';
import { observePost } from '@post-tracker/db';
import { json, parseBody, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Metrics seen by the extension on an already tracked post (throttled server-side). */
export async function POST(req: Request) {
  const body = await parseBody(req, observeSchema);
  if (!body.ok) return body.response;
  const { platform, platformPostId, metrics } = body.data;
  return json(await observePost(platform, platformPostId, metrics));
}
