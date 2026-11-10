'use client';

import { Button, EmptyState } from '@post-tracker/ui';
import { AlertTriangle } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbDown = /database|prisma|ECONNREFUSED|Can't reach/i.test(error.message);
  return (
    <EmptyState
      className="py-24"
      icon={<AlertTriangle />}
      title={dbDown ? 'Database unavailable' : 'Something went wrong'}
      description={dbDown ? <>Start it with <code className="font-mono text-xs">pnpm db:start</code> and try again.</> : error.message}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
