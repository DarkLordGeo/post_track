import type {
  DetectedPost,
  ExtractedPost,
  MediaRef,
  PlatformAdapter,
  PostIdentity,
} from '../types';
import { hostMatches, parseCount, preview, safeUrl, toIsoDate } from '../util';

const HOSTS = ['reddit.com', 'redd.it'];
const ID_RE = /^[a-z0-9]{4,12}$/i;

function identity(id: string, subreddit?: string | null): PostIdentity {
  const postId = id.toLowerCase();
  const canonicalUrl = subreddit
    ? `https://www.reddit.com/r/${subreddit}/comments/${postId}/`
    : `https://www.reddit.com/comments/${postId}/`;
  return { platform: 'REDDIT', platformPostId: postId, canonicalUrl };
}

/** Strip the "t3_" thing prefix used by Reddit's fullnames. */
function fromFullname(fullname: string | null): string | null {
  if (!fullname) return null;
  const id = fullname.replace(/^t3_/i, '');
  return fullname.toLowerCase().startsWith('t3_') && ID_RE.test(id) ? id : null;
}

export function parseRedditUrl(url: string): PostIdentity | null {
  const parsed = safeUrl(url);
  if (!parsed || !hostMatches(parsed.hostname, HOSTS)) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);

  // https://redd.it/abc123
  if (hostMatches(parsed.hostname, ['redd.it'])) {
    return parts[0] && ID_RE.test(parts[0]) ? identity(parts[0]) : null;
  }
  // /r/{sub}/comments/{id}/..., /user/{name}/comments/{id}/..., /comments/{id}/...
  const commentsIdx = parts.indexOf('comments');
  if (commentsIdx === -1) return null;
  const id = parts[commentsIdx + 1];
  if (!id || !ID_RE.test(id)) return null;
  const subreddit = parts[0] === 'r' && commentsIdx === 2 ? parts[1] : null;
  return identity(id, subreddit);
}

// --- New Reddit ("shreddit" web components) -------------------------------------------------

function isShredditPost(el: Element): boolean {
  return el.tagName.toLowerCase() === 'shreddit-post';
}

function shredditIdentity(el: Element, pageUrl: string): PostIdentity | null {
  const permalink = el.getAttribute('permalink');
  if (permalink) {
    const fromLink = parseRedditUrl(new URL(permalink, 'https://www.reddit.com').href);
    if (fromLink) return fromLink;
  }
  const id = fromFullname(el.getAttribute('id'));
  if (id) return identity(id, el.getAttribute('subreddit-name'));
  return parseRedditUrl(pageUrl);
}

function shredditMedia(el: Element): MediaRef[] {
  const media: MediaRef[] = [];
  const type = el.getAttribute('post-type');
  const href = el.getAttribute('content-href');
  if (href && !href.includes('/comments/')) {
    if (type === 'image' || type === 'gallery') media.push({ type: 'image', url: href });
    else if (type === 'video') media.push({ type: 'video', url: href });
    else if (type === 'link') media.push({ type: 'link', url: href });
  }
  const thumb = el.querySelector<HTMLImageElement>('[slot="thumbnail"] img, img[id^="post-image"]');
  const src = thumb?.getAttribute('src');
  if (src && !media.some((m) => m.url === src)) media.push({ type: 'image', url: src });
  return media;
}

function extractShreddit(el: Element, pageUrl: string): ExtractedPost | null {
  const id = shredditIdentity(el, pageUrl);
  if (!id) return null;
  const author = el.getAttribute('author');
  const deleted = !author || author === '[deleted]' || el.hasAttribute('is-author-deleted');
  const bodyEl = el.querySelector('[slot="text-body"]');
  const title =
    el.getAttribute('post-title') ?? el.querySelector('[slot="title"]')?.textContent ?? null;
  return {
    ...id,
    originalUrl: pageUrl,
    authorName: deleted ? null : author,
    authorHandle: deleted ? null : `u/${author}`,
    authorUrl: deleted ? null : `https://www.reddit.com/user/${author}/`,
    title: preview(title, 300),
    contentPreview: preview(bodyEl?.textContent ?? null),
    community: el.getAttribute('subreddit-prefixed-name'),
    media: shredditMedia(el),
    publishedAt: toIsoDate(el.getAttribute('created-timestamp')?.replace(/\+0000$/, 'Z')),
    metrics: {
      // Reddit exposes net score (upvotes minus downvotes); this is what we record as "likes".
      likes: parseCount(el.getAttribute('score')),
      comments: parseCount(el.getAttribute('comment-count')),
      // Reddit does not publish share or view counts.
      shares: null,
      views: null,
    },
  };
}

// --- Old Reddit (old.reddit.com) ------------------------------------------------------------

function isOldThing(el: Element): boolean {
  return el.classList.contains('thing') && !!fromFullname(el.getAttribute('data-fullname'));
}

function extractOld(el: Element, pageUrl: string): ExtractedPost | null {
  const id = fromFullname(el.getAttribute('data-fullname'));
  if (!id) return null;
  const sub = el.getAttribute('data-subreddit');
  const ident = identity(id, sub);
  const author = el.getAttribute('data-author');
  const deleted = !author || author === '[deleted]';
  const url = el.getAttribute('data-url');
  const timestamp = el.getAttribute('data-timestamp');
  const isSelf = url?.startsWith('/r/') ?? false;
  return {
    ...ident,
    originalUrl: pageUrl,
    authorName: deleted ? null : author,
    authorHandle: deleted ? null : `u/${author}`,
    authorUrl: deleted ? null : `https://www.reddit.com/user/${author}/`,
    title: preview(el.querySelector('a.title')?.textContent ?? null, 300),
    contentPreview: preview(el.querySelector('.expando .md')?.textContent ?? null),
    community: sub ? `r/${sub}` : null,
    media: url && !isSelf ? [{ type: 'link', url }] : [],
    publishedAt: timestamp ? toIsoDate(Number(timestamp)) : null,
    metrics: {
      likes: parseCount(el.getAttribute('data-score')),
      comments: parseCount(el.getAttribute('data-comments-count')),
      shares: null,
      views: null,
    },
  };
}

export const redditAdapter: PlatformAdapter = {
  platform: 'REDDIT',
  hosts: HOSTS,
  parseUrl: parseRedditUrl,

  detectPosts(root) {
    const found: DetectedPost[] = [];
    root.querySelectorAll('shreddit-post').forEach((element) => {
      const creditBar = [...element.querySelectorAll('[slot="credit-bar"]')].find(
        (bar) => bar.closest('shreddit-post') === element,
      );
      found.push(
        creditBar
          ? { element, anchor: creditBar, placement: 'append' }
          : { element, anchor: element, placement: 'after' },
      );
    });
    root.querySelectorAll('.thing.link[data-fullname]').forEach((element) => {
      if (!isOldThing(element)) return;
      const buttons = element.querySelector('.flat-list.buttons');
      found.push({ element, anchor: buttons ?? element, placement: buttons ? 'append' : 'after' });
    });
    return found;
  },

  identify(element, pageUrl) {
    if (isShredditPost(element)) return shredditIdentity(element, pageUrl);
    if (isOldThing(element)) {
      const id = fromFullname(element.getAttribute('data-fullname'));
      return id ? identity(id, element.getAttribute('data-subreddit')) : null;
    }
    return null;
  },

  extract(element, pageUrl) {
    if (isShredditPost(element)) return extractShreddit(element, pageUrl);
    if (isOldThing(element)) return extractOld(element, pageUrl);
    return null;
  },
};
