import { Badge } from '@post-tracker/ui';
import type { TrackingStatus } from '@post-tracker/db';

const MAP: Record<TrackingStatus, { label: string; tone: 'success' | 'warn' | 'danger' }> = {
  ACTIVE: { label: 'Tracking', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'warn' },
  UNAVAILABLE: { label: 'Unavailable', tone: 'danger' },
};

export function StatusBadge({ status }: { status: TrackingStatus }) {
  const s = MAP[status];
  return (
    <Badge tone={s.tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </Badge>
  );
}
