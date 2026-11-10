'use client';

import * as React from 'react';
import { cn } from './cn';

/**
 * Modal dialog on top of the native <dialog> element (focus trapping, Esc to close and
 * top-layer rendering come from the browser). Full-width sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (outside the panel) closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-xl border border-border bg-surface p-0 text-fg shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-[1px]',
        'sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-lg',
        'open:animate-fade-up',
        className,
      )}
    >
      {/* Contents are only mounted while open, so closed dialogs add nothing to the page. */}
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="border-b border-border px-5 pt-5 pb-4">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-fg-muted">{description}</div>}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
