import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-fg-muted ring-1 ring-inset ring-border',
        success: 'bg-accent-soft text-accent ring-1 ring-inset ring-accent/20',
        warn: 'bg-warn-soft text-[color:oklch(0.5_0.12_60)] dark:text-warn ring-1 ring-inset ring-warn/30',
        danger: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/20',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
