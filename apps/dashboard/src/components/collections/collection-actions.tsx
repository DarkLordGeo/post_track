'use client';

import { Button, Dialog } from '@post-tracker/ui';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { AddPostsDialog } from './add-posts-dialog';
import { CollectionFormDialog } from './collection-form-dialog';

export function CollectionActions({
  collection,
}: {
  collection: { id: string; name: string; postCount: number };
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'rename' | 'delete' | 'add' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/collections/${collection.id}`, { method: 'DELETE' });
      router.push('/collections');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => setDialog('add')}>
          <Plus /> Add posts
        </Button>
        <Button size="sm" onClick={() => setDialog('rename')}>
          <Pencil /> Rename
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setDialog('delete')}
          aria-label="Delete collection"
        >
          <Trash2 />
        </Button>
      </div>

      <AddPostsDialog
        open={dialog === 'add'}
        onClose={() => setDialog(null)}
        collectionId={collection.id}
        onAdded={() => router.refresh()}
      />
      <CollectionFormDialog
        open={dialog === 'rename'}
        onClose={() => setDialog(null)}
        collection={collection}
        onSaved={() => {
          setDialog(null);
          router.refresh();
        }}
      />
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title={`Delete “${collection.name}”?`}
        description={
          <>
            The collection is removed. Its {collection.postCount}{' '}
            {collection.postCount === 1 ? 'post stays' : 'posts stay'} tracked, with all engagement
            history.
          </>
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete collection'}
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
