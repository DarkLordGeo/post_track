/**
 * Parse human formatted counts: "1,234", "1.2k", "3.4M", "12 comments", "1.2万" is not supported.
 * Returns null when the text contains no recognisable number (unavailable, not zero).
 */
export function parseCount(input: string | null | undefined): number | null {
  if (input == null) return null;
  const text = String(input).trim().replace(/ /g, ' ');
  if (!text) return null;
  const match = text.match(/(-?\d[\d,.\s]*)\s*([kKmMbB])?/);
  if (!match) return null;
  const rawNumber = match[1]!.replace(/[\s,]/g, '');
  let value = Number.parseFloat(rawNumber);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') value *= 1_000;
  else if (suffix === 'm') value *= 1_000_000;
  else if (suffix === 'b') value *= 1_000_000_000;
  return Math.round(value);
}

/** Collapse whitespace and cut text to a preview length on a word boundary. */
export function preview(text: string | null | undefined, max = 500): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max)}…`;
}

export function safeUrl(input: string, base?: string): URL | null {
  try {
    return new URL(input, base);
  } catch {
    return null;
  }
}

export function hostMatches(hostname: string, hosts: string[]): boolean {
  const h = hostname.toLowerCase();
  return hosts.some((host) => h === host || h.endsWith(`.${host}`));
}

export function toIsoDate(value: string | number | null | undefined): string | null {
  if (value == null || value === '') return null;
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
