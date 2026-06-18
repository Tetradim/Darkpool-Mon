import { describe, expect, it } from 'vitest';

import { VIEW_MODES, getViewModeLabel } from './viewModes';

describe('VIEW_MODES', () => {
  it('keeps the primary app views in a stable operator-facing order', () => {
    expect(VIEW_MODES.map((mode) => mode.id)).toEqual([
      'dashboard',
      'intent',
      'options',
      'scanner',
      'flowmap',
      'alerts',
      'watchlist',
      'replay',
      'admin',
      'health',
    ]);
  });

  it('provides concise labels and tooltips for the header navigation', () => {
    for (const mode of VIEW_MODES) {
      expect(mode.label.length).toBeGreaterThan(2);
      expect(mode.label.length).toBeLessThanOrEqual(10);
      expect(mode.description.length).toBeGreaterThan(8);
    }
  });

  it('falls back to Dashboard for unknown view ids', () => {
    expect(getViewModeLabel('missing-view')).toBe('Dashboard');
  });
});
