import { describe, expect, it } from 'vitest';

import { ALERT_SEVERITY_FILTERS, ALERT_STATE_FILTERS, filterAlerts } from './alertFilters';

describe('filterAlerts', () => {
  const alerts = [
    { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA' },
    { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL' },
    { id: '3', state: 'snoozed', severity: 'medium', symbol: 'MSFT' },
    { id: '4', state: 'resolved', severity: 'low', symbol: 'TSLA' },
  ];

  it('exposes stable state and severity filter options', () => {
    expect(ALERT_STATE_FILTERS).toEqual(['all', 'new', 'acknowledged', 'snoozed', 'resolved']);
    expect(ALERT_SEVERITY_FILTERS).toEqual(['all', 'critical', 'high', 'medium', 'low']);
  });

  it('filters alerts by state and severity together', () => {
    expect(filterAlerts(alerts, { state: 'new', severity: 'critical' })).toEqual([
      { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA' },
    ]);
  });

  it('treats unknown filter values as all', () => {
    expect(filterAlerts(alerts, { state: 'missing', severity: 'unknown' })).toEqual(alerts);
  });

  it('keeps severity filtering independent from state filtering', () => {
    expect(filterAlerts(alerts, { state: 'all', severity: 'high' })).toEqual([
      { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL' },
    ]);
  });
});
