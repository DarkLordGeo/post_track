import { describe, expect, it } from 'vitest';
import { parseCount, preview, toIsoDate } from '../src';

describe('parseCount', () => {
  it.each([
    ['1,234', 1234],
    ['1.2k', 1200],
    ['3.4M', 3_400_000],
    ['12 comments', 12],
    ['0', 0],
    ['-5', -5],
  ])('parses %s', (input, expected) => expect(parseCount(input)).toBe(expected));

  it('returns null (unavailable) rather than 0 for missing values', () => {
    expect(parseCount(null)).toBeNull();
    expect(parseCount('')).toBeNull();
    expect(parseCount('Reply')).toBeNull();
  });
});

describe('preview', () => {
  it('collapses whitespace and truncates on a word boundary', () => {
    expect(preview('  hello \n  world ')).toBe('hello world');
    const out = preview('word '.repeat(200), 50)!;
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('handles invalid input', () => {
    expect(toIsoDate('nope')).toBeNull();
    expect(toIsoDate(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});
