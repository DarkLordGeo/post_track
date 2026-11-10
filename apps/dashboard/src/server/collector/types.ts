import type { Metrics, Platform } from '@post-tracker/core';

export interface CollectTarget {
  id: string;
  platform: Platform;
  platformPostId: string;
}

export type FetchResult =
  | { kind: 'ok'; metrics: Metrics }
  /** The post was deleted, removed or made private. */
  | { kind: 'gone'; reason: string }
  | { kind: 'error'; reason: string };

export type BatchResult =
  /** `retryAt` set when the quota is nearly exhausted: pause the platform after this batch. */
  | { kind: 'results'; results: Map<string, FetchResult>; retryAt?: Date }
  /** Back off the whole platform until `retryAt`. */
  | { kind: 'rate-limited'; retryAt: Date }
  /** The platform cannot be collected server-side (no API access / credentials). */
  | { kind: 'unsupported'; reason: string };

export interface PlatformFetcher {
  platform: Platform;
  /** Max posts the fetcher wants per batch. */
  batchSize: number;
  fetchBatch(targets: CollectTarget[]): Promise<BatchResult>;
}
