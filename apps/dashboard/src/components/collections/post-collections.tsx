'use client';

import { Button, Select } from '@post-tracker/ui';
import { Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiFetch } from '@/lib/api-client';
import { CollectionFormDialog } from './collection-form-dialog';

type Ref = { id: string; name: string };
const NEW = '__new__';

/** Collections card on the post detail page. */
export function PostCollections({
  postId,
  memberOf,
  all,
}: {
  postId: string;
  memberOf: Ref[];
  all: Ref[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const available = all.filter((c) => !memberOf.some((m) => m.id === c.id));
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setChoice('');
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const addTo = (collectionId: string) =>
    run('add', () =>
      apiFetch(`/api/collections/${collectionId}/posts`, {
        method: 'POST',
        body: JSON.stringify({ postIds: [postId] }),
      }),
    );

  const removeFrom = (collectionId: string) =>
    run(collectionId, () =>
      apiFetch(`/api/collections/${collectionId}/posts/${postId}`, { method: 'DELETE' }),
    );

  return (
    <div className="space-y-3">
      {memberOf.length === 0 ? (
        <p className="text-sm text-fg-muted">Not in any collection yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Collections this post belongs to">
          {memberOf.map((c) => (
            <li
              key={c.id}
              className="inline-flex max-w-full items-center rounded-full border border-border bg-surface-2 pl-2.5 text-[13px]"
            >
              <Link
                href={`/collections/${c.id}`}
                className="truncate py-1 font-medium text-fg hover:text-accent"
              >
                {c.name}
              </Link>
              <button
                type="button"
                onClick={() => removeFrom(c.id)}
                disabled={busy === c.id}
                aria-label={`Remove from ${c.name}`}
                className="ml-0.5 grid size-7 shrink-0 place-items-center rounded-full text-fg-subtle hover:bg-danger-soft hover:text-danger pointer-coarse:size-9"
              >
                {busy === c.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <X className="size-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice && choice !== NEW) void addTo(choice);
        }}
      >
        <Select
          value={choice}
          onChange={(e) => {
            if (e.target.value === NEW) setCreating(true);
            else setChoice(e.target.value);
          }}
          aria-label="Add to collection"
          className="min-w-0 flex-1"
        >
          <option value="">
            {available.length ? 'Add to collection…' : 'No other collections'}
          </option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>+ New collection…</option>
        </Select>
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0"
          disabled={!choice || busy === 'add'}
        >
          {busy === 'add' ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <CollectionFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setCreating(false);
          void addTo(c.id);
        }}
      />
    </div>
  );
}
