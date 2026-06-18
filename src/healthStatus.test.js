import { describe, expect, it } from 'vitest';

import { summarizeHealthStatus } from './healthStatus';

describe('summarizeHealthStatus', () => {
  it('reports healthy when metrics and connectors are within normal bounds', () => {
    expect(
      summarizeHealthStatus(
        {
          feed_lag_ms: 40,
          dropped_events: 0,
          parser_errors: 1,
          cpu_usage_pct: 35,
        },
        [
          { name: 'FINRA', status: 'connected' },
          { name: 'Polygon', status: 'healthy' },
        ]
      )
    ).toEqual({
      status: 'healthy',
      label: 'Healthy',
      toneClass: 'border-green-500/30 bg-green-500/10 text-green-200',
      summary: 'Feeds are current and connectors are online.',
      reasons: ['2/2 connectors online'],
      connectorCounts: { online: 2, degraded: 0, offline: 0, total: 2 },
    });
  });

  it('reports degraded when non-critical metrics cross warning thresholds', () => {
    const summary = summarizeHealthStatus(
      {
        feed_lag_ms: 650,
        dropped_events: 12,
        parser_errors: 3,
        cpu_usage_pct: 78,
      },
      [
        { name: 'FINRA', status: 'connected' },
        { name: 'Intrinio', status: 'offline' },
      ]
    );

    expect(summary.status).toBe('degraded');
    expect(summary.label).toBe('Degraded');
    expect(summary.summary).toBe('Monitor latency or connector quality needs attention.');
    expect(summary.reasons).toEqual([
      'Feed lag 650ms',
      '12 dropped events',
      'CPU 78%',
      '1 connector offline',
      '1/2 connectors online',
    ]);
    expect(summary.connectorCounts).toEqual({ online: 1, degraded: 0, offline: 1, total: 2 });
  });

  it('reports critical when hard thresholds are crossed', () => {
    const summary = summarizeHealthStatus(
      {
        feed_lag_ms: 2500,
        dropped_events: 51,
        parser_errors: 14,
        cpu_usage_pct: 96,
      },
      [{ name: 'SIP/NBBO', status: 'error' }]
    );

    expect(summary.status).toBe('critical');
    expect(summary.label).toBe('Critical');
    expect(summary.reasons).toContain('Feed lag 2500ms');
    expect(summary.reasons).toContain('51 dropped events');
    expect(summary.reasons).toContain('14 parser errors');
    expect(summary.reasons).toContain('CPU 96%');
    expect(summary.reasons).toContain('1 connector offline');
  });
});
