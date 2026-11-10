'use client';

import { cn } from '@post-tracker/ui';
import { FolderOpen, LayoutDashboard, ListFilter, Moon, Puzzle, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/posts', label: 'Tracked posts', short: 'Posts', icon: ListFilter },
  { href: '/collections', label: 'Collections', icon: FolderOpen },
  { href: '/extension', label: 'Extension', icon: Puzzle },
] as { href: string; label: string; short?: string; icon: typeof Puzzle }[];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      <span className="grid size-6 place-items-center rounded-md bg-fg text-bg">
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M2 11.5 6 7.5l2.5 2.5L14 4.5" />
          <path d="M10.5 4.5H14V8" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Post Tracker</span>
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('pt-theme', next ? 'dark' : 'light');
    } catch {
      // storage unavailable (private mode); theme still applies for this session
    }
  };
  return (
    <button
      onClick={toggle}
      className="grid size-10 place-items-center rounded-md text-fg-muted md:size-8 transition-colors hover:bg-surface-2 hover:text-fg pointer-coarse:size-11"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg/85 px-3 py-2 backdrop-blur md:h-dvh md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0 md:px-3 md:py-4">
        <Logo />
        <nav className="mt-6 hidden flex-col gap-0.5 md:flex" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors pointer-coarse:py-2.5',
                isActive(href)
                  ? 'bg-surface text-fg shadow-card ring-1 ring-border'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="md:mt-auto md:flex md:items-center md:justify-between md:px-1">
          <span className="hidden text-[11px] text-fg-subtle md:inline">v0.1 · local</span>
          <ThemeToggle />
        </div>
      </aside>
      {/* Bottom tab bar on small screens: labelled, thumb-reachable, safe-area aware. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              isActive(href) ? 'text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon className={cn('size-5', isActive(href) && 'text-accent')} />
            {short ?? label}
          </Link>
        ))}
      </nav>
      <main className="min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 pt-8 pb-5 sm:px-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere] text-fg">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
