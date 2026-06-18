import { describe, expect, it } from 'vitest';

import { filterDataSources, summarizeDataSources, summarizeHealthStatus } from './healthStatus';

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

describe('filterDataSources', () => {
  const sources = [
    { id: 'finra', name: 'FINRA ADF', provider: 'FINRA', status: 'connected', feed_lag_ms: 40 },
    { id: 'polygon', name: 'Polygon Trades', provider: 'Polygon', status: 'stale', feed_lag_ms: 900 },
    { id: 'sip', name: 'SIP/NBBO', provider: 'CTA', status: 'error', feed_lag_ms: 2300 },
  ];

  it('filters data sources by normalized status group', () => {
    expect(filterDataSources(sources, { status: 'online' }).map((source) => source.id)).toEqual(['finra']);
    expect(filterDataSources(sources, { status: 'degraded' }).map((source) => source.id)).toEqual(['polygon']);
    expect(filterDataSources(sources, { status: 'offline' }).map((source) => source.id)).toEqual(['sip']);
  });

  it('filters data sources by case-insensitive query across name and provider', () => {
    expect(filterDataSources(sources, { query: 'poly' }).map((source) => source.id)).toEqual(['polygon']);
    expect(filterDataSources(sources, { query: 'cta' }).map((source) => source.id)).toEqual(['sip']);
  });
});

describe('summarizeDataSources', () => {
  it('summarizes source throughput, lag, and worst connector', () => {
    expect(
      summarizeDataSources([
        { name: 'FINRA ADF', status: 'connected', events_received: 1200, feed_lag_ms: 40 },
        { name: 'Polygon Trades', status: 'stale', events_received: 300, feed_lag_ms: 900 },
        { name: 'SIP/NBBO', status: 'error', events_received: 0, feed_lag_ms: 2300 },
      ])
    ).toEqual({
      totalEvents: 1500,
      averageLagMs: 1080,
      worstLag: { name: 'SIP/NBBO', feed_lag_ms: 2300 },
      onlinePct: 33.3,
      tone: 'critical',
    });
  });
});
