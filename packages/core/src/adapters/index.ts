import type { PlatformAdapter, PostIdentity } from '../types';
import { hostMatches, safeUrl } from '../util';
import { redditAdapter } from './reddit';

export { redditAdapter };

export const adapters: PlatformAdapter[] = [redditAdapter];

export function adapterForUrl(url: string): PlatformAdapter | null {
  const parsed = safeUrl(url);
  if (!parsed) return null;
  return adapters.find((a) => hostMatches(parsed.hostname, a.hosts)) ?? null;
}

/** Resolve any supported post URL to its stable identity. */
export function identifyUrl(url: string): PostIdentity | null {
  return adapterForUrl(url)?.parseUrl(url) ?? null;
}
