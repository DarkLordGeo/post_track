import { EmptyState } from '@post-tracker/ui';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      icon={<FileQuestion />}
      title="Post not found"
      description="It may have been removed from your collection."
      action={
        <Link href="/posts" className="text-sm font-medium text-accent hover:underline">
          Back to tracked posts
        </Link>
      }
    />
  );
}
