import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Advanced view UI wiring', () => {
  const source = readFileSync(new URL('./AdvancedViews.jsx', import.meta.url), 'utf8');

  it('wires flow map summary cards into existing Flow Map filters', () => {
    const flowMapViewSource = source.slice(
      source.indexOf('const FlowMapView = () => {'),
      source.indexOf('// Replay Component')
    );

    expect(flowMapViewSource).toContain('setSymbolQuery(heatmapSummary.topSymbol.symbol)');
    expect(flowMapViewSource).toContain('setMinScore(70)');
    expect(flowMapViewSource).toContain('Clear Filters');
  });

  it('wires replay summary cards into existing Replay filters', () => {
    const replayViewSource = source.slice(
      source.indexOf('const ReplayView = () => {'),
      source.indexOf('// Admin View Component')
    );

    expect(replayViewSource).toContain('setSymbolQuery(replaySummary.topSymbol.symbol)');
    expect(replayViewSource).toContain("setSideFilter('BUY')");
    expect(replayViewSource).toContain("setSideFilter('SELL')");
    expect(replayViewSource).toContain('Clear Filters');
  });
});
