export const DEFAULT_API_BASE = 'http://localhost:3000';

export async function getApiBase(): Promise<string> {
  const { apiBase } = await browser.storage.local.get('apiBase');
  return typeof apiBase === 'string' && apiBase ? apiBase.replace(/\/+$/, '') : DEFAULT_API_BASE;
}

export async function setApiBase(value: string) {
  await browser.storage.local.set({ apiBase: value.replace(/\/+$/, '') });
}
