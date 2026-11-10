import type {
  DetectedPost,
  ExtractedPost,
  MediaRef,
  PlatformAdapter,
  PostIdentity,
} from '../types';
import { hostMatches, parseCount, preview, safeUrl, toIsoDate } from '../util';

/**
 * LinkedIn (logged-in feed and single post pages). Posts carry an
 * `urn:li:activity:<id>` URN; the id also encodes the publish time. Unverified against live
 * pages in CI (LinkedIn requires login).
 */
const HOSTS = ['linkedin.com'];
const URN_RE = /urn:li:(activity|share|ugcPost):(\d{10,25})/;

function identity(kind: string, id: string): PostIdentity {
  // Activity ids are the canonical public identifier; other URN kinds are namespaced so they
  // can never collide with an activity id.
  const platformPostId = kind === 'activity' ? id : `${kind}:${id}`;
  return {
    platform: 'LINKEDIN',
    platformPostId,
    canonicalUrl: `https://www.linkedin.com/feed/update/urn:li:${kind}:${id}/`,
  };
}

export function parseLinkedInUrl(url: string): PostIdentity | null {
  const parsed = safeUrl(url);
  if (!parsed || !hostMatches(parsed.hostname, HOSTS)) return null;
  const path = decodeURIComponent(parsed.pathname);
  const urn = path.match(URN_RE);
  if (urn) return identity(urn[1]!, urn[2]!);
  // /posts/{author}_{slug}-activity-{id}-{hash}
  const slug = path.match(/^\/posts\/.*-(activity|share|ugcPost)-(\d{10,25})-/);
  return slug ? identity(slug[1]!, slug[2]!) : null;
}

/** LinkedIn ids are snowflake-style: the top 41 bits are a millisecond timestamp. */
export function linkedInIdToDate(id: string): string | null {
  try {
    const ms = Number(BigInt(id) >> 22n);
    return ms > Date.UTC(2003, 0, 1) && ms < Date.now() + 86_400_000 ? toIsoDate(ms) : null;
  } catch {
    return null;
  }
}

function urnOf(el: Element): RegExpMatchArray | null {
  return (el.getAttribute('data-urn') ?? el.getAttribute('data-id') ?? '').match(URN_RE);
}

function countFrom(el: Element, selectors: string[], pattern?: RegExp): number | null {
  for (const sel of selectors) {
    for (const node of el.querySelectorAll(sel)) {
      const text = `${node.getAttribute('aria-label') ?? ''} ${node.textContent ?? ''}`;
      if (pattern && !pattern.test(text)) continue;
      const n = parseCount(text);
      if (n !== null) return n;
    }
  }
  return null;
}

function media(el: Element): MediaRef[] {
  const out: MediaRef[] = [];
  el.querySelectorAll<HTMLImageElement>(
    '.update-components-image img, .feed-shared-image img',
  ).forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('data:')) out.push({ type: 'image', url: src });
  });
  el.querySelectorAll('video').forEach((v) => {
    const poster = v.getAttribute('poster');
    if (poster) out.push({ type: 'video', url: poster });
  });
  const article = el.querySelector<HTMLAnchorElement>('.update-components-article a[href^="http"]');
  if (article) out.push({ type: 'link', url: article.href });
  return out;
}

export const linkedInAdapter: PlatformAdapter = {
  platform: 'LINKEDIN',
  hosts: HOSTS,
  parseUrl: parseLinkedInUrl,

  detectPosts(root) {
    const found: DetectedPost[] = [];
    const seen = new Set<Element>();
    root
      .querySelectorAll('[data-urn^="urn:li:activity:"], [data-id^="urn:li:activity:"]')
      .forEach((element) => {
        // Skip nested duplicates (outer wrapper and inner card can both carry the urn).
        if ([...seen].some((s) => s.contains(element) || element.contains(s))) return;
        seen.add(element);
        const bar = element.querySelector(
          '.feed-shared-social-action-bar, .social-actions, .update-v2-social-activity',
        );
        found.push(
          bar
            ? { element, anchor: bar, placement: 'append' }
            : { element, anchor: element, placement: 'prepend' },
        );
      });
    return found;
  },

  identify(element, pageUrl) {
    const urn = urnOf(element);
    return urn ? identity(urn[1]!, urn[2]!) : parseLinkedInUrl(pageUrl);
  },

  extract(element, pageUrl): ExtractedPost | null {
    const id = linkedInAdapter.identify(element, pageUrl);
    if (!id) return null;
    // Selectors in priority order (a selector list would return the outermost match instead).
    const nameEl = [
      '.update-components-actor__title span[aria-hidden="true"]',
      '.update-components-actor__name span[aria-hidden="true"]',
      '.update-components-actor__title',
    ]
      .map((sel) => element.querySelector(sel))
      .find(Boolean);
    const authorLink = element.querySelector<HTMLAnchorElement>(
      'a.update-components-actor__meta-link, a.update-components-actor__image, .update-components-actor__container a[href*="/in/"], .update-components-actor__container a[href*="/company/"]',
    );
    const authorUrl = authorLink?.getAttribute('href')?.split('?')[0] ?? null;
    const rawId = id.platformPostId.replace(/^\w+:/, '');
    return {
      ...id,
      originalUrl: pageUrl,
      authorName: preview(nameEl?.textContent, 200),
      authorHandle: null,
      authorUrl: authorUrl ? new URL(authorUrl, 'https://www.linkedin.com').href : null,
      title: null,
      contentPreview: preview(
        element.querySelector(
          '.update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text',
        )?.textContent,
      ),
      community: null,
      media: media(element),
      publishedAt: linkedInIdToDate(rawId),
      metrics: {
        // LinkedIn hides the counts bar entirely when a post has no engagement, which is
        // indistinguishable from "not rendered yet" — so missing counts stay unavailable.
        likes: countFrom(element, [
          '.social-details-social-counts__reactions-count',
          '[data-test-id="social-actions__reaction-count"]',
        ]),
        comments: countFrom(
          element,
          ['.social-details-social-counts__comments', 'button[aria-label*="comment"]'],
          /comment/i,
        ),
        shares: countFrom(
          element,
          ['.social-details-social-counts__item', 'button[aria-label*="repost"]'],
          /repost/i,
        ),
        views: null,
      },
    };
  },
};
