import { describe, expect, it } from 'vitest';

import { REPLAY_SIDE_FILTERS, filterReplayEvents, summarizeReplayEvents } from './replayFilters';

describe('filterReplayEvents', () => {
  const events = [
    { symbol: 'NVDA', side: 'BUY', size: 120000, price: 900, timestamp: '2026-06-18T14:30:00Z' },
    { symbol: 'AAPL', side: 'SELL', size: 60000, price: 190, timestamp: '2026-06-18T14:31:00Z' },
    { symbol: 'MSFT', side: 'BUY', size: 25000, price: 420, timestamp: '2026-06-18T14:32:00Z' },
  ];

  it('exposes stable replay side filter options', () => {
    expect(REPLAY_SIDE_FILTERS).toEqual(['ALL', 'BUY', 'SELL']);
  });

  it('filters replay events by side and symbol query', () => {
    expect(filterReplayEvents(events, { side: 'BUY', query: 'nv' })).toEqual([
      { symbol: 'NVDA', side: 'BUY', size: 120000, price: 900, timestamp: '2026-06-18T14:30:00Z' },
    ]);
  });

  it('keeps only events above the minimum size threshold', () => {
    expect(filterReplayEvents(events, { minSize: 50000 }).map((event) => event.symbol)).toEqual([
      'NVDA',
      'AAPL',
    ]);
  });

  it('treats unknown side filters as ALL while preserving size and query filters', () => {
    expect(filterReplayEvents(events, { side: 'BLOCK', query: 'm', minSize: 20000 })).toEqual([
      { symbol: 'MSFT', side: 'BUY', size: 25000, price: 420, timestamp: '2026-06-18T14:32:00Z' },
    ]);
  });
});

describe('summarizeReplayEvents', () => {
  it('summarizes replay counts, notional, side mix, and top symbol', () => {
    expect(
      summarizeReplayEvents([
        { symbol: 'NVDA', side: 'BUY', size: 100000, price: 900 },
        { symbol: 'NVDA', side: 'SELL', size: 50000, price: 910 },
        { symbol: 'AAPL', side: 'BUY', size: 20000, price: 190 },
      ])
    ).toEqual({
      totalEvents: 3,
      totalNotional: 139300000,
      buyCount: 2,
      sellCount: 1,
      topSymbol: { symbol: 'NVDA', count: 2, notional: 135500000 },
    });
  });
});
