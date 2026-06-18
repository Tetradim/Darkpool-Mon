import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Dashboard UI shortcut wiring', () => {
  const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

  it('wires dashboard pulse and focus cards into existing dashboard filters', () => {
    expect(source).toContain('onSelectSymbol');
    expect(source).toContain('setSelectedStock(dashboardPulse.leader.symbol)');
    expect(source).toContain('setSelectedStock(dashboardPulse.latestAlert.symbol)');
    expect(source).toContain("setFeedSort('LARGEST')");
    expect(source).toContain('<FocusQueue queue={dashboardPulse.focusQueue} onSelectSymbol={setSelectedStock} />');
  });
});
