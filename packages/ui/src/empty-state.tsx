import * as React from 'react';
import { cn } from './cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      {icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-lg border border-border bg-surface-2 text-fg-muted shadow-card [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && (
        <div className="mt-1 max-w-sm text-sm text-fg-muted text-pretty">{description}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
