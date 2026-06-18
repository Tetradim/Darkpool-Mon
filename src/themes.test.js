import { describe, expect, it } from 'vitest';

import * as themes from './themes';

const { THEMES, getThemeCSS, getThemeStyle } = themes;

describe('theme helpers', () => {
  it('builds React-compatible CSS variables for the selected theme', () => {
    expect(getThemeStyle('MATRIX')).toMatchObject({
      '--color-bg': THEMES.MATRIX.background,
      '--color-card': THEMES.MATRIX.card,
      '--color-accent': THEMES.MATRIX.accent,
      '--color-accent-green': THEMES.MATRIX.accentGreen,
      '--color-accent-red': THEMES.MATRIX.accentRed,
    });
  });

  it('falls back to the default theme for unknown theme names', () => {
    expect(getThemeStyle('MISSING')['--color-accent']).toBe(THEMES.DEFAULT.accent);
  });

  it('keeps the CSS string helper backed by the same theme variables', () => {
    const css = getThemeCSS('FIRE');

    expect(css).toContain(`--color-bg: ${THEMES.FIRE.background};`);
    expect(css).toContain(`--color-accent-yellow: ${THEMES.FIRE.accentYellow};`);
  });

  it('exports clean option Greek symbols for settings help text', () => {
    const expectedGreekSymbols = {
      delta: String.fromCharCode(0x0394),
      gamma: String.fromCharCode(0x0393),
      theta: String.fromCharCode(0x0398),
      vega: String.fromCharCode(0x03bd),
      rho: String.fromCharCode(0x03c1),
    };
    const mojibakeMarker = new RegExp(
      `[${String.fromCharCode(0x00c2)}${String.fromCharCode(0x00ce)}${String.fromCharCode(0x00cf)}]`
    );

    expect(themes.GREEK_SYMBOLS).toEqual(expectedGreekSymbols);
    expect(Object.values(themes.GREEK_SYMBOLS).join('')).not.toMatch(mojibakeMarker);
  });

  it('describes provider options with execution status for settings cards', () => {
    expect(themes.PROVIDER_OPTIONS).toEqual([
      {
        id: 'finra',
        label: 'FINRA',
        badge: 'RUNNABLE',
        runnable: true,
        requiresApiKey: false,
        detail: 'Primary live OTC aggregate feed.',
      },
      {
        id: 'polygon',
        label: 'Polygon',
        badge: 'NOT WIRED',
        runnable: false,
        requiresApiKey: true,
        detail: 'API key can be saved, but live execution is not wired yet.',
      },
      {
        id: 'intrinio',
        label: 'Intrinio',
        badge: 'NOT WIRED',
        runnable: false,
        requiresApiKey: true,
        detail: 'API key can be saved, but live execution is not wired yet.',
      },
    ]);
  });
});
