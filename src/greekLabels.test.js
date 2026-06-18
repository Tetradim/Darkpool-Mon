import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { OPTION_GREEK_FILTERS, OPTION_GREEK_SYMBOLS } from './greekLabels';

describe('option Greek labels', () => {
  it('renders canonical option Greek symbols from ASCII-safe code points', () => {
    expect(OPTION_GREEK_SYMBOLS).toEqual({
      delta: String.fromCharCode(0x0394),
      gamma: String.fromCharCode(0x0393),
      theta: String.fromCharCode(0x0398),
      vega: String.fromCharCode(0x03bd),
      rho: String.fromCharCode(0x03c1),
    });

    expect(OPTION_GREEK_FILTERS.map((item) => item.codePoint)).toEqual([
      'U+0394',
      'U+0393',
      'U+0398',
      'U+03BD',
      'U+03C1',
    ]);
  });

  it('keeps the source file ASCII-only to prevent encoding mojibake', () => {
    const source = readFileSync(new URL('./greekLabels.js', import.meta.url), 'utf8');

    expect(source).toMatch(/0x0394/);
    expect(source).not.toMatch(/[^\x00-\x7F]/);
  });
});
