'use client';

import { Button } from '@post-tracker/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CollectionFormDialog } from './collection-form-dialog';

export function NewCollectionButton({
  variant = 'primary',
}: {
  variant?: 'primary' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus /> New collection
      </Button>
      <CollectionFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSaved={(c) => {
          setOpen(false);
          router.push(`/collections/${c.id}`);
        }}
      />
    </>
  );
}
