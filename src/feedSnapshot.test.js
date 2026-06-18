import { describe, expect, it } from 'vitest';

import { buildFeedSnapshotCards, summarizeFeedSnapshot } from './feedSnapshot';

describe('feed snapshot helpers', () => {
  const rows = [
    { symbol: 'AAPL', direction: 'BUY', size: 50000, price: 200, value: 10000000 },
    { symbol: 'NVDA', direction: 'SELL', size: 25000, price: 200, value: 5000000 },
    { symbol: 'MSFT', direction: 'BUY', size: 20000, price: 250, value: 5000000 },
  ];

  it('summarizes filtered feed notional, side split, and largest print', () => {
    expect(summarizeFeedSnapshot(rows)).toEqual({
      count: 3,
      totalNotional: 20000000,
      buyNotional: 15000000,
      sellNotional: 5000000,
      buyRatio: 75,
      sellRatio: 25,
      largest: rows[0],
    });
  });

  it('builds compact operator-facing feed snapshot cards', () => {
    expect(buildFeedSnapshotCards(rows)).toEqual([
      { label: 'Matched', value: '3 prints', detail: 'Current filters' },
      { label: 'Notional', value: '$20.0M', detail: 'Filtered tape' },
      { label: 'Buy / Sell', value: '75% / 25%', detail: 'By notional' },
      { label: 'Largest', value: 'AAPL $10.0M', detail: 'BUY 50.0K sh' },
    ]);
  });

  it('returns stable empty-state snapshot cards when filters match nothing', () => {
    expect(buildFeedSnapshotCards([])).toEqual([
      { label: 'Matched', value: '0 prints', detail: 'Current filters' },
      { label: 'Notional', value: '$0.0M', detail: 'Filtered tape' },
      { label: 'Buy / Sell', value: '0% / 0%', detail: 'By notional' },
      { label: 'Largest', value: 'None', detail: 'No print in view' },
    ]);
  });
});
