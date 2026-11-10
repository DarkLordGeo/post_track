import { PLATFORMS, trackPostSchema, type TrackResponse } from '@post-tracker/core';
import { listPosts, trackPost, type SortKey } from '@post-tracker/db';
import { appUrl, errorResponse, json, parseBody, preflight } from '@/lib/http';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Track a post. Idempotent: tracking an already-tracked post returns it with `created: false`. */
export async function POST(req: Request) {
  const body = await parseBody(req, trackPostSchema);
  if (!body.ok) return body.response;
  try {
    const { post, created } = await trackPost(body.data);
    const res: TrackResponse = { created, post: { id: post.id, dashboardUrl: `${appUrl(req)}/posts/${post.id}` } };
    return json(res, { status: created ? 201 : 200 });
  } catch (err) {
    console.error('track failed', err);
    return errorResponse(500, 'Could not save the post');
  }
}

const listQuery = z.object({
  q: z.string().optional(),
  platform: z.enum(PLATFORMS).optional(),
  sort: z.enum(['tracked', 'published', 'likes', 'comments', 'shares', 'views']).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = listQuery.safeParse(params);
  if (!parsed.success) return errorResponse(422, 'Invalid query', parsed.error.issues);
  const result = await listPosts({ ...parsed.data, sort: parsed.data.sort as SortKey | undefined });
  return json(result);
}
