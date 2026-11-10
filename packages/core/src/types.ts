export const PLATFORMS = ['REDDIT', 'X', 'LINKEDIN'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const METRIC_KEYS = ['likes', 'comments', 'shares', 'views'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * Engagement counts. `null` means the platform did not expose the value (unavailable),
 * which is deliberately different from `0` (observed zero engagement).
 */
export type Metrics = Record<MetricKey, number | null>;

export interface MediaRef {
  type: 'image' | 'video' | 'link';
  url: string;
}

/** Identity of a post, derivable from its URL alone. */
export interface PostIdentity {
  platform: Platform;
  platformPostId: string;
  canonicalUrl: string;
}

/** Everything an adapter could extract from a rendered post. */
export interface ExtractedPost extends PostIdentity {
  originalUrl: string;
  authorName: string | null;
  authorHandle: string | null;
  authorUrl: string | null;
  title: string | null;
  contentPreview: string | null;
  community: string | null;
  media: MediaRef[];
  publishedAt: string | null;
  metrics: Metrics;
}

/** Where the extension should mount the "Track this post" action for a detected post. */
export interface DetectedPost {
  element: Element;
  /** Element the action button is inserted after/into. */
  anchor: Element;
  placement: 'append' | 'after' | 'prepend';
}

export interface PlatformAdapter {
  platform: Platform;
  /** Hostnames the adapter handles (no wildcards; subdomains are matched by suffix). */
  hosts: string[];
  /** Parse any post URL on this platform into a stable identity; null if not a post URL. */
  parseUrl(url: string): PostIdentity | null;
  /** Find post containers currently rendered in the document. */
  detectPosts(root: ParentNode): DetectedPost[];
  /** Identify a detected post element without full extraction (cheap). */
  identify(element: Element, pageUrl: string): PostIdentity | null;
  /** Extract full metadata and visible engagement for a post element. */
  extract(element: Element, pageUrl: string): ExtractedPost | null;
}

export const EMPTY_METRICS: Metrics = { likes: null, comments: null, shares: null, views: null };
