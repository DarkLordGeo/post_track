'use client';

import { Button } from '@post-tracker/ui';
import { Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function PostActions({
  id,
  status,
}: {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'UNAVAILABLE';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function run(
    name: string,
    fn: () => Promise<Response>,
    onOk?: (res: Response) => Promise<string | void>,
  ) {
    setBusy(name);
    setMessage(null);
    try {
      const res = await fn();
      if (!res.ok && res.status !== 204)
        throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
      const text = await onOk?.(res);
      if (text) setMessage({ tone: 'ok', text });
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage({ tone: 'err', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const collect = () =>
    run(
      'collect',
      () => fetch(`/api/posts/${id}/collect`, { method: 'POST' }),
      async (res) => {
        const s = await res.json();
        if (s.collected) return 'Fresh snapshot collected.';
        if (s.unavailable) return 'The post is no longer available.';
        if (s.rateLimited?.length) return 'Rate limited — will retry automatically.';
        return s.notes?.[0] ?? 'Collection failed; see status below.';
      },
    );

  const toggle = () =>
    run('toggle', () =>
      fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }),
      }),
    );

  const remove = () => {
    if (!confirm('Stop tracking this post and delete its history?')) return;
    run(
      'delete',
      () => fetch(`/api/posts/${id}`, { method: 'DELETE' }),
      async () => {
        router.push('/posts');
      },
    );
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={collect} disabled={!!busy || status === 'PAUSED'}>
          <RefreshCw className={busy === 'collect' ? 'animate-spin' : ''} />
          Collect now
        </Button>
        <Button size="sm" onClick={toggle} disabled={!!busy}>
          {status === 'PAUSED' ? <Play /> : <Pause />}
          {status === 'PAUSED' ? 'Resume' : status === 'UNAVAILABLE' ? 'Retry tracking' : 'Pause'}
        </Button>
        <Button size="sm" variant="danger" onClick={remove} disabled={!!busy} aria-label="Delete">
          <Trash2 />
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className={`max-w-sm text-right text-xs ${message.tone === 'ok' ? 'text-fg-muted' : 'text-danger'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
