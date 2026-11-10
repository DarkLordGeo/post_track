import { EmptyState } from '@post-tracker/ui';
import { FolderX } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      icon={<FolderX />}
      title="Collection not found"
      description="It may have been deleted. Its posts are still tracked."
      action={
        <Link href="/collections" className="text-sm font-medium text-accent hover:underline">
          Back to collections
        </Link>
      }
    />
  );
}
