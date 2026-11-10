import { METRIC_KEYS, type MetricKey, type Metrics } from '@post-tracker/core';

type SnapshotLike = Record<MetricKey, number | null> & { capturedAt: Date };

export function latestMetrics(p: {
  latestLikes: number | null;
  latestComments: number | null;
  latestShares: number | null;
  latestViews: number | null;
}): Metrics {
  return {
    likes: p.latestLikes,
    comments: p.latestComments,
    shares: p.latestShares,
    views: p.latestViews,
  };
}

/** Change between the first and last snapshot where the metric was observed on both. */
export function metricDelta(snapshots: SnapshotLike[], key: MetricKey): number | null {
  const observed = snapshots
    .filter((s) => s[key] !== null)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  if (observed.length < 2) return null;
  return observed.at(-1)![key]! - observed[0]![key]!;
}

export function availableKeys(snapshots: SnapshotLike[]): MetricKey[] {
  return METRIC_KEYS.filter((k) => snapshots.some((s) => s[k] !== null));
}
