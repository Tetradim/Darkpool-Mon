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

  it('shows active dashboard filters and clears only filter controls', () => {
    expect(source).toContain('buildDashboardFilterChips(dashboardControls)');
    expect(source).toContain('hasCustomDashboardFilters(dashboardControls)');
    expect(source).toContain('const handleClearDashboardFilters = () => {');
    expect(source).toContain('setSelectedStock(DASHBOARD_CONTROL_DEFAULTS.selectedStock)');
    expect(source).toContain('setTimeframe(DASHBOARD_CONTROL_DEFAULTS.timeframe)');
    expect(source).toContain('setThreshold(DASHBOARD_CONTROL_DEFAULTS.threshold)');
    expect(source).toContain('setWhaleThreshold(DASHBOARD_CONTROL_DEFAULTS.whaleThreshold)');
    expect(source).toContain('setFeedSort(DASHBOARD_CONTROL_DEFAULTS.feedSort)');
    expect(source).toContain('aria-label="Active dashboard filters"');
    expect(source).toContain('Clear Filters');
  });

  it('summarizes the filtered live feed before listing transactions', () => {
    expect(source).toContain('buildFeedSnapshotCards(filteredTransactions)');
    expect(source).toContain('feedSnapshotCards.map((card)');
    expect(source).toContain('aria-label="Filtered feed snapshot"');
    expect(source).toContain('Showing {filteredTransactions.length} of {transactions.length} transactions');
    expect(source).toContain('No transactions match the active filters.');
  });
});
