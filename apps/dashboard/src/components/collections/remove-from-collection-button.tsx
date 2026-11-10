'use client';

import { cn } from '@post-tracker/ui';
import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { apiFetch } from '@/lib/api-client';

/** Removes the post from the collection only; the tracked post and its history stay. */
export function RemoveFromCollectionButton({
  collectionId,
  postId,
  postTitle,
}: {
  collectionId: string;
  postId: string;
  postTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/collections/${collectionId}/posts/${postId}`, { method: 'DELETE' });
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={`Remove “${postTitle}” from this collection`}
      title={error ?? 'Remove from collection'}
      className={cn(
        'grid size-9 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50 pointer-coarse:size-11',
        error && 'text-danger',
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </button>
  );
}
