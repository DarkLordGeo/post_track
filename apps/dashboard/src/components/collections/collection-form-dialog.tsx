'use client';

import { Button, Dialog, Input } from '@post-tracker/ui';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Saved = { id: string; name: string };

/** Create a collection, or rename one when `collection` is given. */
export function CollectionFormDialog({
  open,
  onClose,
  collection,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  collection?: Saved;
  onSaved: (saved: Saved) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(collection?.name ?? '');
      setError(null);
    }
  }, [open, collection?.name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await apiFetch<Saved>(
        collection ? `/api/collections/${collection.id}` : '/api/collections',
        { method: collection ? 'PATCH' : 'POST', body: JSON.stringify({ name }) },
      );
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const formId = collection ? 'rename-collection' : 'new-collection';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={collection ? 'Rename collection' : 'New collection'}
      description={collection ? undefined : 'Group posts from Reddit, X and LinkedIn together.'}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : collection ? 'Save' : 'Create collection'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-2">
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-fg">
          Name
        </label>
        <Input
          id={`${formId}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Product launch coverage"
          autoFocus
          aria-invalid={!!error}
          aria-describedby={error ? `${formId}-error` : undefined}
        />
        {error && (
          <p id={`${formId}-error`} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
