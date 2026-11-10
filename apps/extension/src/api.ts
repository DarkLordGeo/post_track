import { postKey, type ExtractedPost, type LookupResponse, type Metrics, type Platform, type TrackResponse } from '@post-tracker/core';
import type { Result } from './messages';
import { getApiBase } from './settings';

async function call<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const base = await getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    return { ok: false, error: `Can't reach Post Tracker at ${base}. Is the dashboard running?` };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error ?? `HTTP ${res.status}`;
    return { ok: false, error: `Post Tracker: ${detail}` };
  }
  return { ok: true, data: body as T };
}

export const api = {
  track: (post: ExtractedPost) => call<TrackResponse>('/api/posts', { method: 'POST', body: JSON.stringify(post) }),
  lookup: (posts: { platform: Platform; platformPostId: string }[]) =>
    call<LookupResponse>('/api/posts/lookup', { method: 'POST', body: JSON.stringify({ posts }) }),
  observe: (platform: Platform, platformPostId: string, metrics: Metrics) =>
    call<{ recorded: boolean; reason?: string }>('/api/posts/observe', {
      method: 'POST',
      body: JSON.stringify({ platform, platformPostId, metrics }),
    }),
  health: () => call<{ ok: boolean }>('/api/health'),
};

export { postKey };
