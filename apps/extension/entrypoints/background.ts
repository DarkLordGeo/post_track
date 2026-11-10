import { api } from '../src/api';
import type { Request, Result } from '../src/messages';
import { getApiBase } from '../src/settings';

async function handle(msg: Request): Promise<Result<unknown>> {
  switch (msg.type) {
    case 'track':
      return api.track(msg.post);
    case 'lookup':
      return api.lookup(msg.posts);
    case 'observe':
      return api.observe(msg.platform, msg.platformPostId, msg.metrics);
    case 'health': {
      const r = await api.health();
      return { ok: true, data: { ok: r.ok, apiBase: await getApiBase() } };
    }
    case 'open-dashboard': {
      const base = await getApiBase();
      await browser.tabs.create({ url: `${base}${msg.path ?? '/'}` });
      return { ok: true, data: null };
    }
    default:
      return { ok: false, error: 'Unknown message' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: Request, _sender, sendResponse) => {
    handle(msg)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: (err as Error).message }));
    return true; // keep the channel open for the async response
  });
});
