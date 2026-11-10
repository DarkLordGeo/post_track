import {
  hasAnyMetric,
  postKey,
  type DetectedPost,
  type PlatformAdapter,
  type PostIdentity,
} from '@post-tracker/core';
import { send } from './messages';
import { BUTTON_CSS, TOAST_CSS } from './styles';

type State = 'unknown' | 'idle' | 'saving' | 'tracked' | 'error';

interface Mounted {
  host: HTMLElement;
  button: HTMLButtonElement;
  element: Element;
  /** Null until resolved on click, for platforms that don't expose ids in the DOM. */
  identity: PostIdentity | null;
  state: State;
  dashboardId?: string;
  observed?: boolean;
}

const HOST_TAG = 'post-tracker-action';
const ICONS = {
  track:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11.5 6 7.5l2.5 2.5L14 4.5"/><path d="M10.5 4.5H14V8"/></svg>',
  check:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>',
  spin: '<svg viewBox="0 0 16 16" class="spin" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 2a6 6 0 1 0 6 6"/></svg>',
  alert:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 4.5v4"/><circle cx="8" cy="11.3" r=".6" fill="currentColor"/></svg>',
};

export interface InjectorOptions {
  /** How often to rescan the document after mutations (ms). */
  debounceMs?: number;
}

export function runInjector(adapter: PlatformAdapter, opts: InjectorOptions = {}) {
  const byKey = new Map<string, Set<Mounted>>();
  const mountedFor = new WeakMap<Element, Mounted>();
  let toastRoot: ShadowRoot | null = null;
  let scanTimer: number | undefined;

  function render(m: Mounted, errorText?: string) {
    const b = m.button;
    b.dataset.state = m.state;
    b.disabled = m.state === 'saving' || m.state === 'unknown';
    const label = {
      unknown: ['spin', 'Track'],
      idle: ['track', 'Track'],
      saving: ['spin', 'Saving…'],
      tracked: ['check', 'Tracked'],
      error: ['alert', 'Retry'],
    }[m.state] as [keyof typeof ICONS, string];
    b.innerHTML = `${ICONS[label[0]]}<span>${label[1]}</span>`;
    b.title =
      m.state === 'tracked'
        ? 'Tracked in Post Tracker — click to open in the dashboard'
        : m.state === 'error'
          ? (errorText ?? 'Something went wrong — click to retry')
          : 'Track this post in Post Tracker';
    b.setAttribute(
      'aria-label',
      m.state === 'tracked' ? 'Tracked — open in Post Tracker' : 'Track this post',
    );
  }

  function setState(
    key: string,
    state: State,
    extra?: { dashboardId?: string; error?: string; onlyIf?: State },
  ) {
    for (const m of byKey.get(key) ?? []) {
      // Lookups can resolve after a save finished (e.g. the page re-rendered the post mid-save);
      // they must never downgrade a button that has moved on.
      if (extra?.onlyIf && m.state !== extra.onlyIf) continue;
      m.state = state;
      if (extra?.dashboardId) m.dashboardId = extra.dashboardId;
      render(m, extra?.error);
    }
  }

  function toast(text: string, tone: 'ok' | 'err', action?: { label: string; run: () => void }) {
    if (!toastRoot) {
      const host = document.createElement('post-tracker-toasts');
      document.documentElement.appendChild(host);
      toastRoot = host.attachShadow({ mode: 'open' });
      toastRoot.innerHTML = `<style>${TOAST_CSS}</style><div class="stack" role="status" aria-live="polite"></div>`;
    }
    const stack = toastRoot.querySelector('.stack')!;
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.innerHTML = `<span class="dot"></span><span class="msg"></span>`;
    el.querySelector('.msg')!.textContent = text;
    if (action) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.addEventListener('click', action.run);
      el.appendChild(btn);
    }
    stack.appendChild(el);
    setTimeout(() => el.classList.add('out'), tone === 'err' ? 6000 : 3500);
    setTimeout(() => el.remove(), tone === 'err' ? 6400 : 3900);
  }

  async function onClick(m: Mounted, ev: Event) {
    // Reddit cards are wrapped in full-card links; never let the click navigate.
    ev.preventDefault();
    ev.stopPropagation();

    if (m.state === 'tracked') {
      void send({
        type: 'open-dashboard',
        path: m.dashboardId ? `/posts/${m.dashboardId}` : '/posts',
      });
      return;
    }
    if (m.state !== 'idle' && m.state !== 'error') return;

    if (!m.identity) {
      m.state = 'saving';
      render(m);
      const resolved = (await adapter.resolveIdentity?.(m.element)) ?? null;
      if (!resolved) {
        m.state = 'error';
        const msg = 'Could not find this post’s id on the page.';
        render(m, msg);
        toast(msg, 'err');
        return;
      }
      register(m, resolved);
      // It may already be tracked (e.g. from another device or page).
      const res = await send({
        type: 'lookup',
        posts: [{ platform: resolved.platform, platformPostId: resolved.platformPostId }],
      });
      const existingId = res.ok ? res.data.tracked[postKey(resolved)] : undefined;
      if (existingId) {
        setState(postKey(resolved), 'tracked', { dashboardId: existingId });
        toast('Already tracked', 'ok', {
          label: 'View',
          run: () => void send({ type: 'open-dashboard', path: `/posts/${existingId}` }),
        });
        return;
      }
    }
    const key = postKey(m.identity!);

    const post = adapter.extract(m.element, location.href, m.identity!);
    if (!post) {
      setState(key, 'error', { error: 'Could not read this post from the page.' });
      toast('Could not read this post from the page.', 'err');
      return;
    }
    setState(key, 'saving');
    const res = await send({ type: 'track', post });
    if (res.ok) {
      setState(key, 'tracked', { dashboardId: res.data.post.id });
      toast(res.data.created ? 'Post saved to your collection' : 'Already tracked', 'ok', {
        label: 'View',
        run: () => void send({ type: 'open-dashboard', path: `/posts/${res.data.post.id}` }),
      });
    } else {
      setState(key, 'error', { error: res.error });
      toast(res.error, 'err');
    }
  }

  function register(m: Mounted, identity: PostIdentity) {
    m.identity = identity;
    const key = postKey(identity);
    if (!byKey.has(key)) byKey.set(key, new Set());
    const existing = [...byKey.get(key)!][0];
    byKey.get(key)!.add(m);
    if (existing && existing.state !== 'unknown') {
      m.state = existing.state;
      m.dashboardId = existing.dashboardId;
    }
  }

  function mount(d: DetectedPost, identity: PostIdentity | null): Mounted {
    const host = document.createElement(HOST_TAG);
    host.style.cssText =
      'display:inline-flex;align-items:center;margin:0 4px;vertical-align:middle;position:relative;z-index:2;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${BUTTON_CSS}</style>`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pt-btn';
    shadow.appendChild(button);
    // Stop the page from treating presses on the button as clicks on the post card.
    for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }

    if (d.placement === 'append') d.anchor.appendChild(host);
    else if (d.placement === 'prepend') d.anchor.prepend(host);
    else d.anchor.insertAdjacentElement('afterend', host);

    // Posts whose id is only resolvable on click start out trackable.
    const m: Mounted = {
      host,
      button,
      element: d.element,
      identity: null,
      state: identity ? 'unknown' : 'idle',
    };
    // Activate on pointerdown: some sites (X) re-render the action bar the moment the pointer
    // goes down, so a `click` may never be dispatched. Keyboard activation still uses `click`.
    let handledPointer = false;
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      handledPointer = true;
      setTimeout(() => (handledPointer = false), 600);
      void onClick(m, e);
    });
    button.addEventListener('click', (e) => {
      if (handledPointer) {
        handledPointer = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      void onClick(m, e);
    });
    if (identity) register(m, identity);
    mountedFor.set(d.element, m);
    render(m);
    return m;
  }

  async function resolveStatus(fresh: Mounted[]) {
    const pending = fresh.filter((m) => m.state === 'unknown' && m.identity);
    if (!pending.length) return;
    const keys = [...new Map(pending.map((m) => [postKey(m.identity!), m.identity!])).values()];
    const res = await send({
      type: 'lookup',
      posts: keys.map(({ platform, platformPostId }) => ({ platform, platformPostId })),
    });
    for (const id of keys) {
      const key = postKey(id);
      if (!res.ok) {
        // Unknown status: still let the user try; the server dedupes anyway.
        setState(key, 'idle', { onlyIf: 'unknown' });
        continue;
      }
      const dashboardId = res.data.tracked[key];
      setState(key, dashboardId ? 'tracked' : 'idle', { dashboardId, onlyIf: 'unknown' });
    }
    if (res.ok) observeTracked(pending);
  }

  /** Record a snapshot of metrics visible on the page for posts that are already tracked. */
  function observeTracked(list: Mounted[]) {
    for (const m of list) {
      if (m.state !== 'tracked' || m.observed) continue;
      m.observed = true;
      const post = adapter.extract(m.element, location.href, m.identity ?? undefined);
      if (post && hasAnyMetric(post.metrics)) {
        void send({
          type: 'observe',
          platform: post.platform,
          platformPostId: post.platformPostId,
          metrics: post.metrics,
        });
      }
    }
  }

  function prune() {
    for (const [key, set] of byKey) {
      for (const m of set) if (!m.host.isConnected) set.delete(m);
      if (!set.size) byKey.delete(key);
    }
  }

  function scan() {
    prune();
    const fresh: Mounted[] = [];
    for (const d of adapter.detectPosts(document)) {
      const prev = mountedFor.get(d.element);
      if (prev?.host.isConnected) continue;
      const identity = adapter.identify(d.element, location.href);
      if (!identity && !adapter.resolveIdentity) continue;
      fresh.push(mount(d, identity));
    }
    void resolveStatus(fresh);
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, opts.debounceMs ?? 250);
  }

  scan();
  const observer = new MutationObserver((records) => {
    // Ignore mutations caused by our own elements.
    if (
      records.every((r) =>
        [...r.addedNodes].every(
          (n) => n instanceof Element && n.tagName.toLowerCase() === HOST_TAG,
        ),
      )
    )
      return;
    scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return {
    stop() {
      observer.disconnect();
      window.clearTimeout(scanTimer);
      document.querySelectorAll(HOST_TAG).forEach((el) => el.remove());
    },
    scan,
  };
}
