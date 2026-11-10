import { PLATFORM_META, type Platform } from '@post-tracker/core';
import { cn } from '@post-tracker/ui';

const MARK: Record<Platform, { bg: string; glyph: React.ReactNode }> = {
  REDDIT: {
    bg: 'bg-reddit text-white',
    glyph: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <circle cx="10" cy="11.5" r="5.2" />
        <circle cx="14.6" cy="4.6" r="1.4" />
        <path d="M10 6.4 11 3.6l3.4.8" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="8" cy="11" r=".95" className="fill-reddit" />
        <circle cx="12" cy="11" r=".95" className="fill-reddit" />
      </svg>
    ),
  },
  X: {
    bg: 'bg-x text-bg',
    glyph: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M11.6 8.9 17 3h-1.3l-4.7 5.1L7.3 3H3l5.7 8L3 17h1.3l5-5.4 4 5.4H17l-5.4-8.1Zm-1.8 1.9-.6-.8L4.7 4h2l3.7 5.2.6.8 4.8 6.9h-2l-4-5.1Z" />
      </svg>
    ),
  },
  LINKEDIN: {
    bg: 'bg-linkedin text-white',
    glyph: (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M5.2 7.6h2.3V15H5.2V7.6Zm1.2-3.7a1.3 1.3 0 1 1 0 2.7 1.3 1.3 0 0 1 0-2.7ZM9 7.6h2.2v1c.3-.6 1.1-1.2 2.3-1.2 2.4 0 2.9 1.6 2.9 3.7V15h-2.3v-3.5c0-.8 0-1.9-1.2-1.9s-1.4.9-1.4 1.8V15H9V7.6Z" />
      </svg>
    ),
  },
};

export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  const m = MARK[platform];
  return (
    <span
      title={PLATFORM_META[platform].label}
      className={cn('inline-grid size-5 shrink-0 place-items-center rounded-[5px] [&_svg]:size-[70%]', m.bg, className)}
    >
      {m.glyph}
    </span>
  );
}

export function PlatformLabel({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
      <PlatformMark platform={platform} className="size-4" />
      {PLATFORM_META[platform].label}
    </span>
  );
}
