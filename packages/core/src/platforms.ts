import type { MetricKey, Platform } from './types';

export interface PlatformMeta {
  label: string;
  /** Per-metric display label; metrics absent from the map are never available on the platform. */
  metrics: Partial<Record<MetricKey, string>>;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  REDDIT: { label: 'Reddit', metrics: { likes: 'Score', comments: 'Comments' } },
  X: {
    label: 'X',
    metrics: { likes: 'Likes', comments: 'Replies', shares: 'Reposts', views: 'Views' },
  },
  LINKEDIN: {
    label: 'LinkedIn',
    metrics: { likes: 'Reactions', comments: 'Comments', shares: 'Reposts' },
  },
};
