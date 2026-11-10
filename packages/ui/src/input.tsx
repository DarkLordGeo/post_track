import * as React from 'react';
import { cn } from './cn';

const field =
  'h-9 pointer-coarse:h-11 rounded-md border border-border bg-surface px-3 text-sm text-fg shadow-card placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, 'w-full', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        field,
        'appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E")] bg-[length:12px] bg-[position:right_10px_center] bg-no-repeat',
        className,
      )}
      {...props}
    />
  );
}
