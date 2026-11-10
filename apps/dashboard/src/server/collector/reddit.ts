import type { BatchResult, CollectTarget, FetchResult, PlatformFetcher } from './types';

/**
 * Reddit blocks anonymous server-side access to its JSON endpoints (403), so collection uses
 * the official OAuth API with an application-only token. Requires REDDIT_CLIENT_ID/SECRET.
 */
export interface RedditConfig {
  clientId?: string;
  clientSecret?: string;
  userAgent: string;
  fetch?: typeof fetch;
  now?: () => number;
}

interface RedditThing {
  kind: string;
  data: {
    id: string;
    score?: number;
    num_comments?: number;
    removed_by_category?: string | null;
    author?: string;
    selftext?: string;
  };
}

export function createRedditFetcher(config: RedditConfig): PlatformFetcher {
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? Date.now;
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > now() + 60_000) return token.value;
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const res = await doFetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': config.userAgent,
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`Reddit auth failed (HTTP ${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: body.access_token, expiresAt: now() + body.expires_in * 1000 };
    return token.value;
  }

  return {
    platform: 'REDDIT',
    batchSize: 100,
    async fetchBatch(targets: CollectTarget[]): Promise<BatchResult> {
      if (!config.clientId || !config.clientSecret) {
        return {
          kind: 'unsupported',
          reason:
            'Reddit API credentials are not configured (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET).',
        };
      }
      let accessToken: string;
      try {
        accessToken = await getToken();
      } catch (err) {
        return errorAll(targets, (err as Error).message);
      }
      const ids = targets.map((t) => `t3_${t.platformPostId}`).join(',');
      let res: Response;
      try {
        res = await doFetch(`https://oauth.reddit.com/api/info?id=${ids}&raw_json=1`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': config.userAgent },
        });
      } catch (err) {
        return errorAll(targets, `Network error: ${(err as Error).message}`);
      }

      if (res.status === 429) {
        const reset = Number(
          res.headers.get('x-ratelimit-reset') ?? res.headers.get('retry-after') ?? 60,
        );
        return { kind: 'rate-limited', retryAt: new Date(now() + Math.max(reset, 1) * 1000) };
      }
      if (res.status === 401) token = null;
      if (!res.ok) return errorAll(targets, `Reddit API returned HTTP ${res.status}`);

      const body = (await res.json()) as { data?: { children?: RedditThing[] } };
      const byId = new Map(
        (body.data?.children ?? []).map((c) => [c.data.id.toLowerCase(), c.data]),
      );
      const results = new Map<string, FetchResult>();
      for (const t of targets) {
        const data = byId.get(t.platformPostId);
        if (!data) {
          results.set(t.id, { kind: 'gone', reason: 'Post not found on Reddit.' });
        } else if (data.removed_by_category) {
          results.set(t.id, { kind: 'gone', reason: `Removed (${data.removed_by_category}).` });
        } else {
          results.set(t.id, {
            kind: 'ok',
            metrics: {
              likes: typeof data.score === 'number' ? data.score : null,
              comments: typeof data.num_comments === 'number' ? data.num_comments : null,
              shares: null,
              views: null,
            },
          });
        }
      }

      // Be a good citizen: if the remaining quota is nearly exhausted, pause until the reset.
      const remainingHeader = res.headers.get('x-ratelimit-remaining');
      const resetIn = Number(res.headers.get('x-ratelimit-reset'));
      if (remainingHeader !== null && Number(remainingHeader) < 2 && Number.isFinite(resetIn)) {
        return { kind: 'results', results, retryAt: new Date(now() + resetIn * 1000) };
      }
      return { kind: 'results', results };
    },
  };
}

function errorAll(targets: CollectTarget[], reason: string): BatchResult {
  return {
    kind: 'results',
    results: new Map(targets.map((t) => [t.id, { kind: 'error', reason }])),
  };
}
