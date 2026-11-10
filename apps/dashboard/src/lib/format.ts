import type { MetricKey, Platform } from '@post-tracker/core';
import { PLATFORM_META } from '@post-tracker/core';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en');

export function formatCount(n: number | null | undefined, mode: 'compact' | 'full' = 'compact') {
  if (n === null || n === undefined) return null;
  return Math.abs(n) < 10_000 || mode === 'full' ? full.format(n) : compact.format(n);
}

export function formatDelta(n: number | null) {
  if (n === null) return null;
  if (n === 0) return '±0';
  return `${n > 0 ? '+' : '−'}${formatCount(Math.abs(n))}`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
export function timeAgo(date: Date | string | null | undefined, now = Date.now()) {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  const sec = Math.round((d.getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return sec <= 0 ? 'just now' : 'in a moment';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), 'month');
  return rtf.format(Math.round(sec / (86400 * 365)), 'year');
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(date),
  );
}

export function metricLabel(platform: Platform, key: MetricKey) {
  return PLATFORM_META[platform].metrics[key] ?? null;
}

export function postHeadline(p: { title: string | null; contentPreview: string | null }) {
  return p.title ?? p.contentPreview ?? 'Untitled post';
}
