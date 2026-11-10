import { cn } from '@post-tracker/ui';
import { formatCount, formatDelta } from '@/lib/format';

/**
 * Renders a metric value. `null` is shown as an em dash with an explanation, never as 0:
 * unavailable data and zero engagement mean different things.
 */
export function MetricValue({
  value,
  className,
  unavailableHint = 'Not available for this post',
  mode = 'compact',
}: {
  value: number | null | undefined;
  className?: string;
  unavailableHint?: string;
  mode?: 'compact' | 'full';
}) {
  if (value === null || value === undefined) {
    return (
      <span
        className={cn('text-fg-subtle', className)}
        title={unavailableHint}
        aria-label="unavailable"
      >
        —
      </span>
    );
  }
  return (
    <span className={cn('tabular', className)} title={formatCount(value, 'full') ?? undefined}>
      {formatCount(value, mode)}
    </span>
  );
}

export function DeltaChip({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        'tabular inline-flex items-center rounded px-1 text-[11px] font-medium',
        value > 0 && 'bg-up/10 text-up',
        value < 0 && 'bg-down/10 text-down',
        value === 0 && 'bg-surface-2 text-fg-subtle',
        className,
      )}
    >
      {formatDelta(value)}
    </span>
  );
}
