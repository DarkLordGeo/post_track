import { PLATFORM_META, type Platform } from '@post-tracker/core';
import { cn } from '@post-tracker/ui';

/*
 * Official platform marks, unmodified apart from sizing. Sources and terms: see
 * BRAND_ASSETS.md at the repository root.
 * - Reddit "Snoo" symbol and X logo: path data from Simple Icons (CC0), traced from
 *   redditinc.com/brand and x.com. Trademarks of Reddit, Inc. and X Corp.
 * - LinkedIn "In" bug: vector from LinkedIn's official brand site (brand.linkedin.com), in the
 *   current LinkedIn Blue (#0A66C2). Trademark of LinkedIn Corporation.
 */
function RedditLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      {/* White fill behind the knocked-out Snoo, as in Reddit's full-colour symbol. */}
      <circle cx="12" cy="12" r="10.5" fill="#FFFFFF" />
      <path
        fill="#FF4500"
        d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z"
      />
    </svg>
  );
}

function XLogo() {
  // X's guidelines allow the logo in black or white only: it follows the text colour.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-fg">
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0A66C2"
        d="M22.2,0H1.8C0.8,0,0,0.8,0,1.7v20.5c0,1,0.8,1.7,1.8,1.7h20.5c1,0,1.8-0.8,1.8-1.7V1.7C24,0.8,23.2,0,22.2,0z"
      />
      <path
        fill="#FFFFFF"
        d="M3.6,9h3.6v11.5H3.6V9z M5.3,3.3c1.1,0,2.1,0.9,2.1,2.1S6.5,7.4,5.3,7.4c-1.1,0-2.1-0.9-2.1-2.1S4.2,3.3,5.3,3.3"
      />
      <path
        fill="#FFFFFF"
        d="M9.4,9h3.4v1.6h0c0.5-0.9,1.6-1.8,3.4-1.8c3.6,0,4.3,2.4,4.3,5.5v6.3h-3.6v-5.6c0-1.3,0-3-1.9-3c-1.9,0-2.1,1.4-2.1,2.9v5.7H9.4V9z"
      />
    </svg>
  );
}

const LOGO: Record<Platform, () => React.ReactNode> = {
  REDDIT: RedditLogo,
  X: XLogo,
  LINKEDIN: LinkedInLogo,
};

export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  const Logo = LOGO[platform];
  return (
    <span
      role="img"
      aria-label={PLATFORM_META[platform].label}
      title={PLATFORM_META[platform].label}
      className={cn('inline-grid size-5 shrink-0 place-items-center [&_svg]:size-full', className)}
    >
      <Logo />
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

/** A row of marks for a set of platforms, e.g. the platforms inside a collection. */
export function PlatformStack({
  platforms,
  className,
}: {
  platforms: Platform[];
  className?: string;
}) {
  if (platforms.length === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {platforms.map((p) => (
        <PlatformMark key={p} platform={p} className="size-4" />
      ))}
    </span>
  );
}
