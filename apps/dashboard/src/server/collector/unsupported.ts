import type { Platform } from '@post-tracker/core';
import type { PlatformFetcher } from './types';

/**
 * X and LinkedIn do not offer engagement data without paid/partner API access, and scraping
 * them server-side violates their terms. Their snapshots come from the extension instead.
 */
export function unsupportedFetcher(platform: Platform, reason: string): PlatformFetcher {
  return {
    platform,
    batchSize: 100,
    fetchBatch: async () => ({ kind: 'unsupported', reason }),
  };
}
