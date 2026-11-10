import type {
  DetectedPost,
  ExtractedPost,
  MediaRef,
  PlatformAdapter,
  PostIdentity,
} from '../types';
import { hostMatches, parseCount, preview, safeUrl, toIsoDate } from '../util';

/**
 * LinkedIn. Two markups are supported:
 *
 * - Current UI (verified live 2026-11-11): feed cards are `[role="listitem"]` elements with a
 *   `componentkey="update-card…"`, obfuscated class names and **no post id in the DOM**. The
 *   id is only exposed by the card's control menu ("Embed this post" →
 *   `targetUrn=urn:li:share:…`), so it is resolved on demand when the user clicks Track. On a
 *   single-post page the URL identifies the post.
 * - Legacy UI: cards carry `data-urn="urn:li:activity:…"`.
 */
const HOSTS = ['linkedin.com'];
const URN_RE = /urn:li:(activity|share|ugcPost):(\d{10,25})/;
const CARD = '[role="listitem"][componentkey^="update-card"]';
const LEGACY = '[data-urn^="urn:li:activity:"], [data-id^="urn:li:activity:"]';

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

function legacyUrn(el: Element): RegExpMatchArray | null {
  return (el.getAttribute('data-urn') ?? el.getAttribute('data-id') ?? '').match(URN_RE);
}

/** Count from leaf text such as "88 reactions" / "12 comments" (current UI). */
function leafCount(el: Element, noun: RegExp): number | null {
  for (const node of el.querySelectorAll('span, button, a, div, p')) {
    if (node.children.length > 0) continue;
    const text = node.textContent?.trim() ?? '';
    const m = text.match(new RegExp(`^([\\d,.]+[KkMm]?)\\s+${noun.source}$`, 'i'));
    if (m) return parseCount(m[1]);
  }
  return null;
}

/** Count from the legacy social-counts bar. */
function legacyCount(el: Element, selectors: string[], pattern?: RegExp): number | null {
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
  el.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const src = img.getAttribute('src');
    // Post media: /dms/image/v2/<id>/feedshare-… or image-shrink…; avatars are
    // profile-displayphoto-…, logos company-logo-… (verified live 2026-11-11).
    if (
      src &&
      /media\.licdn\.com\/dms\/image\/v\d+\/[^/]+\/(feedshare|image-shrink|articleshare)/.test(src)
    ) {
      if (!out.some((m) => m.url === src)) out.push({ type: 'image', url: src });
    }
  });
  el.querySelectorAll('video').forEach((v) => {
    const poster = v.getAttribute('poster');
    if (poster) out.push({ type: 'video', url: poster });
  });
  return out;
}

function author(el: Element): { name: string | null; url: string | null } {
  // Current UI: "Open control menu for post by Microsoft".
  const menuLabel = el
    .querySelector('[aria-label^="Open control menu for post by "]')
    ?.getAttribute('aria-label');
  const fromMenu = menuLabel?.replace('Open control menu for post by ', '').trim() || null;
  const legacyName = [
    '.update-components-actor__title span[aria-hidden="true"]',
    '.update-components-actor__name span[aria-hidden="true"]',
    '.update-components-actor__title',
  ]
    .map((sel) => el.querySelector(sel))
    .find(Boolean)?.textContent;
  const name = fromMenu ?? preview(legacyName, 200);

  let link: Element | null | undefined = el.querySelector(
    'a.update-components-actor__meta-link, a.update-components-actor__image',
  );
  if (!link && name) {
    // The label can sit on the <a> or on an inner image (e.g. reposts), so match any element.
    const labelled = [...el.querySelectorAll('[aria-label]')].find((node) => {
      const label = node.getAttribute('aria-label') ?? '';
      return (
        label === `View company: ${name}` ||
        label === `View ${name}’s profile` ||
        label === `View ${name}'s profile`
      );
    });
    link = labelled?.closest('a[href]') ?? labelled?.querySelector('a[href]');
  }
  link ??= el.querySelector('a[href*="/in/"], a[href*="/company/"]');
  const href = link?.getAttribute('href')?.split('?')[0];
  return { name, url: href ? new URL(href, 'https://www.linkedin.com').href : null };
}

function waitFor<T>(fn: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const v = fn();
      if (v) return resolve(v);
      if (Date.now() - started > timeoutMs) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

export const linkedInAdapter: PlatformAdapter = {
  platform: 'LINKEDIN',
  hosts: HOSTS,
  parseUrl: parseLinkedInUrl,

  detectPosts(root) {
    const found: DetectedPost[] = [];
    const seen: Element[] = [];
    root.querySelectorAll(`${CARD}, ${LEGACY}`).forEach((element) => {
      // Skip nested duplicates (outer wrapper and inner card can both match).
      if (seen.some((s) => s.contains(element) || element.contains(s))) return;
      seen.push(element);
      const legacyBar = element.querySelector(
        '.feed-shared-social-action-bar, .social-actions, .update-v2-social-activity',
      );
      const repost = element.querySelector('button[aria-label="Repost"]');
      // Current UI: the action bar is the closest ancestor of "Repost" that also holds "Comment".
      let bar: Element | null = legacyBar;
      if (!bar && repost) {
        bar = repost.parentElement;
        while (bar && bar !== element && !bar.querySelector('button[aria-label="Comment"]'))
          bar = bar.parentElement;
      }
      found.push(
        bar && bar !== element
          ? { element, anchor: bar, placement: 'append' }
          : { element, anchor: element, placement: 'prepend' },
      );
    });
    return found;
  },

  identify(element, pageUrl) {
    const urn = legacyUrn(element);
    if (urn) return identity(urn[1]!, urn[2]!);
    // On a single-post page the first card is the post the URL refers to.
    const fromPage = parseLinkedInUrl(pageUrl);
    if (fromPage && element.ownerDocument.querySelector(`${CARD}, ${LEGACY}`) === element)
      return fromPage;
    return null;
  },

  async resolveIdentity(element) {
    const trigger = element.querySelector<HTMLElement>('[aria-label^="Open control menu"]');
    if (!trigger) return null;
    trigger.click();
    const link = await waitFor(
      () => element.ownerDocument.querySelector('[role="menu"] a[href*="targetUrn="]'),
      2500,
    );
    const href = link?.getAttribute('href') ?? '';
    // Close the menu again so the page is left as the user had it.
    if (element.ownerDocument.querySelector('[role="menu"]')) trigger.click();
    const urn = decodeURIComponent(href).match(URN_RE);
    return urn ? identity(urn[1]!, urn[2]!) : null;
  },

  extract(element, pageUrl, resolved): ExtractedPost | null {
    const id = resolved ?? linkedInAdapter.identify(element, pageUrl);
    if (!id) return null;
    const a = author(element);
    const rawId = id.platformPostId.replace(/^\w+:/, '');
    return {
      ...id,
      originalUrl: pageUrl,
      authorName: a.name,
      authorHandle: null,
      authorUrl: a.url,
      title: null,
      contentPreview: preview(
        element.querySelector(
          '[data-testid="expandable-text-box"], .update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text',
        )?.textContent,
      ),
      community: null,
      media: media(element),
      publishedAt: linkedInIdToDate(rawId),
      metrics: {
        // LinkedIn omits counts entirely when they are zero *and* when they are not rendered,
        // so a missing count is recorded as unavailable, never as 0.
        likes:
          leafCount(element, /reactions?/) ??
          legacyCount(element, [
            '.social-details-social-counts__reactions-count',
            '[data-test-id="social-actions__reaction-count"]',
          ]),
        comments:
          leafCount(element, /comments?/) ??
          legacyCount(
            element,
            ['.social-details-social-counts__comments', 'button[aria-label*="comment"]'],
            /\d.*comment/i,
          ),
        shares:
          leafCount(element, /reposts?/) ??
          legacyCount(
            element,
            ['.social-details-social-counts__item', 'button[aria-label*="repost"]'],
            /\d.*repost/i,
          ),
        views: null,
      },
    };
  },
};
