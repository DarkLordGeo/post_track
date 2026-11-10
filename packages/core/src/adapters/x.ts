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

/** The tweet's own permalink is the status link wrapping its timestamp. */
function permalink(el: Element): string | null {
  const time = el.querySelector('time');
  const link = time?.closest('a[href*="/status/"]') ?? null;
  return link?.getAttribute('href') ?? null;
}

/**
 * X renders "123 Likes. Like" when there are likes and just "Like" when there are none, so a
 * present button without a number is a real zero; a missing button means unavailable.
 */
function actionCount(el: Element, testIds: string[]): number | null {
  for (const id of testIds) {
    const btn = el.querySelector(`[data-testid="${id}"]`);
    if (btn) return parseCount(btn.getAttribute('aria-label')) ?? 0;
  }
  return null;
}

function media(el: Element): MediaRef[] {
  const out: MediaRef[] = [];
  el.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) out.push({ type: 'image', url: src });
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
    root.querySelectorAll('article[data-testid="tweet"]').forEach((element) => {
      const bar = [...element.querySelectorAll('[role="group"]')].find(
        (g) => g.closest('article') === element,
      );
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
    const nameBlock = element.querySelector('[data-testid="User-Name"]');
    const handleHref = nameBlock?.querySelector('a[href^="/"]')?.getAttribute('href') ?? null;
    const handle = handleHref?.split('/').filter(Boolean)[0] ?? null;
    const displayName = nameBlock?.querySelector('span')?.textContent?.trim() || null;
    const views =
      element.querySelector('a[href$="/analytics"]')?.getAttribute('aria-label') ?? null;
    return {
      ...id,
      originalUrl: pageUrl,
      authorName: displayName ?? handle,
      authorHandle: handle ? `@${handle}` : null,
      authorUrl: handle ? `https://x.com/${handle}` : null,
      title: null,
      contentPreview: preview(element.querySelector('[data-testid="tweetText"]')?.textContent),
      community: null,
      media: media(element),
      publishedAt: toIsoDate(element.querySelector('time')?.getAttribute('datetime')),
      metrics: {
        likes: actionCount(element, ['like', 'unlike']),
        comments: actionCount(element, ['reply']),
        shares: actionCount(element, ['retweet', 'unretweet']),
        views: parseCount(views),
      },
    };
  },
};
