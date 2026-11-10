import type {
  DetectedPost,
  ExtractedPost,
  MediaRef,
  PlatformAdapter,
  PostIdentity,
} from '../types';
import { hostMatches, parseCount, preview, safeUrl, toIsoDate } from '../util';

/**
 * X (Twitter). Relies on the `data-testid` attributes X ships for accessibility/testing,
 * which have been stable for years. Unverified against live pages in CI (X requires login).
 */
const HOSTS = ['x.com', 'twitter.com'];
const RESERVED = new Set([
  'i',
  'home',
  'explore',
  'search',
  'settings',
  'notifications',
  'messages',
]);

function identity(id: string, handle?: string | null): PostIdentity {
  return {
    platform: 'X',
    platformPostId: id,
    canonicalUrl: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/status/${id}`,
  };
}

export function parseXUrl(url: string): PostIdentity | null {
  const parsed = safeUrl(url, 'https://x.com');
  if (!parsed || !hostMatches(parsed.hostname, HOSTS)) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('status');
  if (idx < 1) return null;
  const id = parts[idx + 1];
  if (!id || !/^\d{5,25}$/.test(id)) return null;
  const handle = parts[idx - 1];
  return identity(id, handle && !RESERVED.has(handle.toLowerCase()) && idx === 1 ? handle : null);
}

/**
 * Find the post's own id. Classic X wraps the timestamp in the permalink; the newer (2026)
 * logged-out UI has no <time> and, on single-post pages, only `/status/{id}/photo/N` links —
 * or none at all, in which case the page URL identifies the post.
 */
function permalink(el: Element): string | null {
  const timeLink = el.querySelector('time')?.closest('a[href*="/status/"]');
  if (timeLink) return timeLink.getAttribute('href');
  for (const a of el.querySelectorAll('a[href*="/status/"]')) {
    // Skip links that belong to a quoted post nested inside this one. (The whole card can
    // itself sit inside a role="link" wrapper, which must not count.)
    const quote = a.closest('[role="link"]');
    if (quote && quote !== el && el.contains(quote)) continue;
    const href = a.getAttribute('href');
    if (href && !href.includes('/compose/')) return href;
  }
  return null;
}

/** Tweet ids are snowflakes: (id >> 22) + Twitter epoch = creation time in ms. */
export function tweetIdToDate(id: string): string | null {
  try {
    return toIsoDate(Number((BigInt(id) >> 22n) + 1288834974657n));
  } catch {
    return null;
  }
}

/**
 * The post's own action bar. Video players also render `role="group"` ("Seek slider"), and
 * quoted posts can contain groups, so pick the group that holds the engagement actions.
 */
function actionBar(el: Element): Element | null {
  const groups = [...el.querySelectorAll('[role="group"]')].filter(
    (g) => g.closest('article') === el,
  );
  return (
    groups.find((g) =>
      g.querySelector(
        '[data-engagement-action], [data-testid="reply"], [data-testid="like"], [data-testid="unlike"]',
      ),
    ) ??
    groups.find((g) =>
      /\d[\d,.]*[KkMm]? (likes?|repl(y|ies)|reposts?|views?)/.test(
        g.getAttribute('aria-label') ?? '',
      ),
    ) ??
    null
  );
}

/**
 * The action bar's aria-label summarises engagement, e.g.
 * "159 replies, 211 reposts, 1584 likes, 71 bookmarks, 513811 views". X omits zero counts
 * ("12 likes, 1174 views"), so when the summary exists a missing reply/repost/like count is a
 * real zero; views can genuinely be absent (older posts) so they stay unavailable.
 */
function summaryMetrics(el: Element) {
  const label = actionBar(el)?.getAttribute('aria-label');
  if (!label || !/\d/.test(label)) return null;
  const pick = (re: RegExp) => {
    const m = label.match(re);
    return m ? parseCount(m[1]) : null;
  };
  return {
    likes: pick(/([\d,.]+[KkMm]?) likes?/) ?? 0,
    comments: pick(/([\d,.]+[KkMm]?) repl(?:y|ies)/) ?? 0,
    shares: pick(/([\d,.]+[KkMm]?) (?:reposts?|retweets?)/) ?? 0,
    views: pick(/([\d,.]+[KkMm]?) views?/),
  };
}

/**
 * Per-button fallback. X renders "123 Likes. Like" when there are likes and just "Like" when
 * there are none, so a present button without a number is a real zero; a missing button means
 * unavailable.
 */
function actionCount(el: Element, testIds: string[]): number | null {
  for (const id of testIds) {
    const btn = el.querySelector(
      `[data-testid="${id}"], [data-engagement-action="${id}"] [aria-label]`,
    );
    if (btn) return parseCount(btn.getAttribute('aria-label')) ?? 0;
  }
  return null;
}

function media(el: Element): MediaRef[] {
  const out: MediaRef[] = [];
  el.querySelectorAll<HTMLImageElement>(
    '[data-testid="tweetPhoto"] img, a[href*="/photo/"] img, img[src*="pbs.twimg.com/media"]',
  ).forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !out.some((m) => m.url === src)) out.push({ type: 'image', url: src });
  });
  el.querySelectorAll('video').forEach((v) => {
    const poster = v.getAttribute('poster');
    if (poster) out.push({ type: 'video', url: poster });
  });
  return out;
}

export const xAdapter: PlatformAdapter = {
  platform: 'X',
  hosts: HOSTS,
  parseUrl: parseXUrl,

  detectPosts(root) {
    const found: DetectedPost[] = [];
    // `data-testid="tweet"` in the classic UI; plain <article> in the newer UI.
    root.querySelectorAll('article').forEach((element) => {
      if (!actionBar(element) && !element.querySelector('a[href*="/status/"]')) return;
      if (element.parentElement?.closest('article')) return;
      const bar = actionBar(element);
      found.push(
        bar
          ? { element, anchor: bar, placement: 'append' }
          : { element, anchor: element, placement: 'append' },
      );
    });
    return found;
  },

  identify(element, pageUrl) {
    const href = permalink(element);
    return href ? parseXUrl(new URL(href, 'https://x.com').href) : parseXUrl(pageUrl);
  },

  extract(element, pageUrl): ExtractedPost | null {
    const id = xAdapter.identify(element, pageUrl);
    if (!id) return null;
    const handle = id.canonicalUrl.match(/x\.com\/([^/]+)\/status\//)?.[1] ?? null;
    const usable = handle && handle !== 'i' ? handle : null;
    const nameBlock = element.querySelector('[data-testid="User-Name"]');
    const displayName =
      nameBlock?.querySelector('span')?.textContent?.trim() ||
      (usable
        ? [...element.querySelectorAll(`a[href="/${usable}"]`)]
            .map((a) => a.textContent?.trim() ?? '')
            .find((t) => t && !t.startsWith('@'))
        : null) ||
      null;
    const textEl =
      element.querySelector('[data-testid="tweetText"]') ??
      [...element.querySelectorAll('div[dir="auto"]')].find(
        (d) => !d.closest('a, button, [role="group"]'),
      );
    const views =
      element.querySelector('a[href$="/analytics"]')?.getAttribute('aria-label') ?? null;
    const summary = summaryMetrics(element);
    return {
      ...id,
      originalUrl: pageUrl,
      authorName: displayName ?? usable,
      authorHandle: usable ? `@${usable}` : null,
      authorUrl: usable ? `https://x.com/${usable}` : null,
      title: null,
      contentPreview: preview(textEl?.textContent),
      community: null,
      media: media(element),
      publishedAt:
        toIsoDate(element.querySelector('time')?.getAttribute('datetime')) ??
        tweetIdToDate(id.platformPostId),
      metrics: summary ?? {
        likes: actionCount(element, ['like', 'unlike']),
        comments: actionCount(element, ['reply']),
        shares: actionCount(element, ['retweet', 'unretweet']),
        views: parseCount(views),
      },
    };
  },
};
