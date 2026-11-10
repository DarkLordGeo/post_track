'use client';

import type { Platform } from '@post-tracker/core';
import { Button, Dialog, Input, Skeleton } from '@post-tracker/ui';
import { Check, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PlatformMark } from '@/components/platform';
import { apiFetch } from '@/lib/api-client';
import { postHeadline } from '@/lib/format';

interface PostRow {
  id: string;
  platform: Platform;
  title: string | null;
  contentPreview: string | null;
  community: string | null;
  authorName: string | null;
}

export function AddPostsDialog({
  open,
  onClose,
  collectionId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  onAdded: () => void;
}) {
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset when opened; load current members once per opening.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setSelected(new Set());
    setError(null);
    apiFetch<{ items: { id: string }[] }>(`/api/posts?collection=${collectionId}&take=200`)
      .then((r) => setMembers(new Set(r.items.map((p) => p.id))))
      .catch((err: Error) => setError(err.message));
  }, [open, collectionId]);

  useEffect(() => {
    if (!open) return;
    setPosts(null);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ take: '100' });
      if (q.trim()) params.set('q', q.trim());
      apiFetch<{ items: PostRow[] }>(`/api/posts?${params}`)
        .then((r) => setPosts(r.items))
        .catch((err: Error) => {
          setError(err.message);
          setPosts([]);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [open, q]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/collections/${collectionId}/posts`, {
        method: 'POST',
        body: JSON.stringify({ postIds: [...selected] }),
      });
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add posts"
      description="Pick tracked posts from any platform."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={add} disabled={saving || selected.size === 0}>
            {saving ? 'Adding…' : selected.size ? `Add ${selected.size}` : 'Add'}
          </Button>
        </>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tracked posts…"
          className="pl-8"
          aria-label="Search tracked posts"
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="mt-3 space-y-1" aria-label="Tracked posts">
        {posts === null &&
          Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-12 w-full" />
            </li>
          ))}
        {posts?.length === 0 && (
          <li className="py-8 text-center text-sm text-fg-muted">
            {q ? 'No tracked posts match your search.' : 'You have not tracked any posts yet.'}
          </li>
        )}
        {posts?.map((p) => {
          const inCollection = members.has(p.id);
          const checked = inCollection || selected.has(p.id);
          return (
            <li key={p.id}>
              <label
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2 ${inCollection ? 'cursor-default opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--color-accent)]"
                  checked={checked}
                  disabled={inCollection}
                  onChange={() => toggle(p.id)}
                />
                <PlatformMark platform={p.platform} className="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {postHeadline(p)}
                  </span>
                  <span className="block truncate text-xs text-fg-muted">
                    {[p.community, p.authorName].filter(Boolean).join(' · ') || ' '}
                  </span>
                </span>
                {inCollection && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted">
                    <Check className="size-3.5" /> Added
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
