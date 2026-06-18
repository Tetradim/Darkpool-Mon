import { describe, expect, it } from 'vitest';

import { ALERT_SEVERITY_FILTERS, ALERT_STATE_FILTERS, filterAlerts, summarizeAlertTriage } from './alertFilters';

describe('filterAlerts', () => {
  const alerts = [
    { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA', alert_type: 'whale_print', channel: 'slack', routing_status: 'sent' },
    { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL', alert_type: 'z_score', channel: 'email', routing_status: 'failed' },
    { id: '3', state: 'snoozed', severity: 'medium', symbol: 'MSFT', alert_type: 'deduped_flow', channel: 'pager', routing_status: 'sent' },
    { id: '4', state: 'resolved', severity: 'low', symbol: 'TSLA', alert_type: 'heartbeat', channel: 'slack', routing_status: 'sent' },
  ];

  it('exposes stable state and severity filter options', () => {
    expect(ALERT_STATE_FILTERS).toEqual(['all', 'new', 'acknowledged', 'snoozed', 'resolved']);
    expect(ALERT_SEVERITY_FILTERS).toEqual(['all', 'critical', 'high', 'medium', 'low']);
  });

  it('filters alerts by state and severity together', () => {
    expect(filterAlerts(alerts, { state: 'new', severity: 'critical' })).toEqual([
      { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA', alert_type: 'whale_print', channel: 'slack', routing_status: 'sent' },
    ]);
  });

  it('treats unknown filter values as all', () => {
    expect(filterAlerts(alerts, { state: 'missing', severity: 'unknown' })).toEqual(alerts);
  });

  it('keeps severity filtering independent from state filtering', () => {
    expect(filterAlerts(alerts, { state: 'all', severity: 'high' })).toEqual([
      { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL', alert_type: 'z_score', channel: 'email', routing_status: 'failed' },
    ]);
  });

  it('filters alerts by query across symbol, type, channel, and route status', () => {
    expect(filterAlerts(alerts, { query: 'score' })).toEqual([
      { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL', alert_type: 'z_score', channel: 'email', routing_status: 'failed' },
    ]);
    expect(filterAlerts(alerts, { query: 'SLACK', severity: 'critical' })).toEqual([
      { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA', alert_type: 'whale_print', channel: 'slack', routing_status: 'sent' },
    ]);
  });

  it('keeps actionable alerts that are new or failed to route', () => {
    expect(filterAlerts(alerts, { actionableOnly: true })).toEqual([
      { id: '1', state: 'new', severity: 'critical', symbol: 'NVDA', alert_type: 'whale_print', channel: 'slack', routing_status: 'sent' },
      { id: '2', state: 'acknowledged', severity: 'high', symbol: 'AAPL', alert_type: 'z_score', channel: 'email', routing_status: 'failed' },
    ]);
  });

  it('summarizes alert triage pressure for operator status cards', () => {
    expect(summarizeAlertTriage(alerts)).toEqual({
      total: 4,
      actionable: 2,
      criticalOpen: 1,
      failedRoutes: 1,
      snoozed: 1,
      resolved: 1,
      tone: 'urgent',
    });
  });
});
