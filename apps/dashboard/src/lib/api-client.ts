/** Fetch JSON from the dashboard API, throwing the server's error message on failure. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Network error — is the dashboard running?');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const issue = Array.isArray(body?.details) ? body.details[0]?.message : null;
    throw new Error(issue ?? body?.error ?? `Request failed (HTTP ${res.status})`);
  }
  return body as T;
}
