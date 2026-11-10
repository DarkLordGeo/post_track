'use client';

import { METRIC_KEYS, PLATFORM_META, type MetricKey, type Platform } from '@post-tracker/core';
import { cn, EmptyState } from '@post-tracker/ui';
import { LineChart as LineIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCount } from '@/lib/format';

export interface ChartPoint {
  t: number;
  source: 'EXTENSION' | 'COLLECTOR';
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
}

const dateFmt = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const axisFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });

export function EngagementChart({
  platform,
  points,
}: {
  platform: Platform;
  points: ChartPoint[];
}) {
  const available = useMemo(
    () => METRIC_KEYS.filter((k) => points.some((p) => p[k] !== null)),
    [points],
  );
  const [metric, setMetric] = useState<MetricKey>(available[0] ?? 'likes');
  const series = points.filter((p) => p[metric] !== null);
  const spanMs = series.length > 1 ? series.at(-1)!.t - series[0]!.t : 0;
  const labels = PLATFORM_META[platform].metrics;

  if (available.length === 0) {
    return (
      <EmptyState
        icon={<LineIcon />}
        title="No engagement data yet"
        description="Metrics appear after the first snapshot is captured."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1" role="tablist">
        {METRIC_KEYS.map((k) => {
          const enabled = available.includes(k);
          return (
            <button
              key={k}
              role="tab"
              disabled={!enabled}
              aria-selected={metric === k}
              onClick={() => setMetric(k)}
              title={
                enabled
                  ? undefined
                  : labels[k]
                    ? 'No data captured yet'
                    : `${PLATFORM_META[platform].label} does not expose this metric`
              }
              className={cn(
                'rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                metric === k ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {labels[k] ?? k[0]!.toUpperCase() + k.slice(1)}
            </button>
          );
        })}
      </div>
      {series.length < 2 ? (
        <div className="grid h-56 place-items-center rounded-md border border-dashed border-border-strong text-center text-sm text-fg-muted">
          <div>
            <p className="font-medium text-fg">
              {formatCount(series[0]?.[metric] ?? null, 'full')}{' '}
              <span className="font-normal text-fg-muted">{labels[metric]?.toLowerCase()}</span>
            </p>
            <p className="mt-1">
              One snapshot so far — the trend line appears after the next collection.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) =>
                  (spanMs < 2 * 86400_000 ? timeFmt : axisFmt).format(t)
                }
                tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                width={44}
                tickFormatter={(v: number) => formatCount(v) ?? ''}
                tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-border-strong)' }}
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-pop">
                      <p className="text-fg-muted">{dateFmt.format(p.t)}</p>
                      <p className="tabular mt-0.5 text-sm font-semibold text-fg">
                        {formatCount(p[metric], 'full')}{' '}
                        <span className="font-normal text-fg-muted">
                          {labels[metric]?.toLowerCase()}
                        </span>
                      </p>
                      <p className="mt-0.5 text-fg-subtle">
                        via {p.source === 'COLLECTOR' ? 'collector' : 'extension'}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#fill)"
                dot={{
                  r: 2.5,
                  fill: 'var(--color-surface)',
                  stroke: 'var(--color-accent)',
                  strokeWidth: 1.5,
                }}
                activeDot={{ r: 4 }}
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
