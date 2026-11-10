import type { ExtractedPost, LookupResponse, Metrics, Platform, TrackResponse } from '@post-tracker/core';

export type Request =
  | { type: 'track'; post: ExtractedPost }
  | { type: 'lookup'; posts: { platform: Platform; platformPostId: string }[] }
  | { type: 'observe'; platform: Platform; platformPostId: string; metrics: Metrics }
  | { type: 'health' }
  | { type: 'open-dashboard'; path?: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ResponseMap {
  track: TrackResponse;
  lookup: LookupResponse;
  observe: { recorded: boolean; reason?: string };
  health: { ok: boolean; apiBase: string };
  'open-dashboard': null;
}

export async function send<T extends Request>(msg: T): Promise<Result<ResponseMap[T['type']]>> {
  try {
    const res = (await browser.runtime.sendMessage(msg)) as Result<ResponseMap[T['type']]> | undefined;
    return res ?? { ok: false, error: 'No response from the extension background worker.' };
  } catch (err) {
    // Happens after the extension is reloaded while an old content script is still on the page.
    const message = (err as Error).message ?? String(err);
    return {
      ok: false,
      error: /context invalidated/i.test(message) ? 'Post Tracker was updated — reload this page.' : message,
    };
  }
}
