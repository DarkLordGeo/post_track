import { z } from 'zod';
import { METRIC_KEYS, PLATFORMS } from './types';

const count = z.number().int().nonnegative().nullable();
// Reddit scores can be negative, so `likes` allows any integer.
export const metricsSchema = z.object({
  likes: z.number().int().nullable(),
  comments: count,
  shares: count,
  views: count,
});

export const mediaSchema = z.object({
  type: z.enum(['image', 'video', 'link']),
  url: z.string().url().max(2048),
});

export const trackPostSchema = z.object({
  platform: z.enum(PLATFORMS),
  platformPostId: z.string().min(1).max(128),
  canonicalUrl: z.string().url().max(2048),
  originalUrl: z.string().url().max(2048),
  authorName: z.string().max(200).nullable(),
  authorHandle: z.string().max(200).nullable(),
  authorUrl: z.string().url().max(2048).nullable(),
  title: z.string().max(1000).nullable(),
  contentPreview: z.string().max(5000).nullable(),
  community: z.string().max(200).nullable(),
  media: z.array(mediaSchema).max(20),
  publishedAt: z.string().datetime().nullable(),
  metrics: metricsSchema,
});
export type TrackPostInput = z.infer<typeof trackPostSchema>;

export const observeSchema = z.object({
  platform: z.enum(PLATFORMS),
  platformPostId: z.string().min(1).max(128),
  metrics: metricsSchema,
});
export type ObserveInput = z.infer<typeof observeSchema>;

export const lookupSchema = z.object({
  posts: z
    .array(z.object({ platform: z.enum(PLATFORMS), platformPostId: z.string().min(1).max(128) }))
    .max(200),
});
export type LookupInput = z.infer<typeof lookupSchema>;

export interface TrackResponse {
  created: boolean;
  post: { id: string; dashboardUrl: string };
}

export interface LookupResponse {
  /** Map of `${platform}:${platformPostId}` → dashboard post id. */
  tracked: Record<string, string>;
}

export const postKey = (p: { platform: string; platformPostId: string }) =>
  `${p.platform}:${p.platformPostId}`;

export function hasAnyMetric(m: Record<(typeof METRIC_KEYS)[number], number | null>): boolean {
  return METRIC_KEYS.some((k) => m[k] !== null);
}
