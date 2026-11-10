import { adapterForUrl, identifyUrl, PLATFORM_META } from '@post-tracker/core';
import { useEffect, useState } from 'react';
import { send } from '../../src/messages';
import { DEFAULT_API_BASE, getApiBase, setApiBase } from '../../src/settings';

type Health = 'checking' | 'online' | 'offline';

export function App() {
  const [health, setHealth] = useState<Health>('checking');
  const [apiBase, setBase] = useState(DEFAULT_API_BASE);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<{ url?: string } | null>(null);
  const [trackedId, setTrackedId] = useState<string | null | undefined>(undefined);

  const check = async () => {
    setHealth('checking');
    const res = await send({ type: 'health' });
    setHealth(res.ok && res.data.ok ? 'online' : 'offline');
  };

  useEffect(() => {
    void getApiBase().then((b) => {
      setBase(b);
      setDraft(b);
    });
    void check();
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([t]) => setTab({ url: t?.url }));
  }, []);

  const identity = tab?.url ? identifyUrl(tab.url) : null;
  const platform = tab?.url ? adapterForUrl(tab.url)?.platform : undefined;

  useEffect(() => {
    if (!identity || health !== 'online') return;
    void send({
      type: 'lookup',
      posts: [{ platform: identity.platform, platformPostId: identity.platformPostId }],
    }).then((r) =>
      setTrackedId(
        r.ok
          ? (r.data.tracked[`${identity.platform}:${identity.platformPostId}`] ?? null)
          : undefined,
      ),
    );
  }, [identity?.platformPostId, health]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    let value = draft.trim();
    try {
      const url = new URL(value);
      value = url.origin;
      const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!isLocal) {
        const granted = await browser.permissions.request({ origins: [`${url.origin}/*`] });
        if (!granted) return;
      }
    } catch {
      return;
    }
    await setApiBase(value);
    setBase(value);
    setEditing(false);
    void check();
  };

  return (
    <div className="popup">
      <header>
        <div className="brand">
          <span className="logo">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M2 11.5 6 7.5l2.5 2.5L14 4.5" />
              <path d="M10.5 4.5H14V8" />
            </svg>
          </span>
          Post Tracker
        </div>
        <span className={`status ${health}`} title={apiBase}>
          <span className="dot" />
          {health === 'online' ? 'Connected' : health === 'offline' ? 'Offline' : 'Checking'}
        </span>
      </header>

      <section className="card">
        {identity ? (
          <>
            <p className="label">{PLATFORM_META[identity.platform].label} post</p>
            <p className="value mono">{identity.platformPostId}</p>
            <p className="hint">
              {trackedId
                ? 'Tracked — engagement is being recorded.'
                : trackedId === null
                  ? 'Not tracked yet. Use the Track button on the page.'
                  : ' '}
            </p>
            {trackedId && (
              <button
                className="primary"
                onClick={() => void send({ type: 'open-dashboard', path: `/posts/${trackedId}` })}
              >
                Open in dashboard
              </button>
            )}
          </>
        ) : platform ? (
          <>
            <p className="label">{PLATFORM_META[platform].label}</p>
            <p className="hint">Track buttons appear on each post in your feed.</p>
          </>
        ) : (
          <>
            <p className="label">No supported post here</p>
            <p className="hint">Open a Reddit post to start tracking.</p>
          </>
        )}
      </section>

      {health === 'offline' && (
        <p className="warn">
          Can't reach the dashboard at {apiBase}. Start it with <code>pnpm dev</code>.
        </p>
      )}

      <div className="row">
        <button
          className="secondary"
          onClick={() => void send({ type: 'open-dashboard', path: '/posts' })}
        >
          All tracked posts
        </button>
        <button className="ghost" onClick={() => setEditing((v) => !v)}>
          Settings
        </button>
      </div>

      {editing && (
        <form
          className="settings"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor="base">Dashboard URL</label>
          <input
            id="base"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={DEFAULT_API_BASE}
          />
          <button className="primary" type="submit">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
