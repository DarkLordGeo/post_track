'use client';

import { cn } from '@post-tracker/ui';
import { LayoutDashboard, ListFilter, Moon, Puzzle, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/posts', label: 'Tracked posts', icon: ListFilter },
  { href: '/extension', label: 'Extension', icon: Puzzle },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1">
      <span className="grid size-6 place-items-center rounded-md bg-fg text-bg">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
    } catch {}
  };
  return (
    <button
      onClick={toggle}
      className="grid size-8 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
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
        <nav className="flex gap-0.5 md:mt-6 md:flex-col">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                isActive(href) ? 'bg-surface text-fg shadow-card ring-1 ring-border' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="md:mt-auto md:flex md:items-center md:justify-between md:px-1">
          <span className="hidden text-[11px] text-fg-subtle md:inline">v0.1 · local</span>
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 pt-8 pb-5 sm:px-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
