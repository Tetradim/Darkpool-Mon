import { describe, expect, it } from 'vitest';

import { clusterPrintLevels, computeZScore, rowsToCsv } from './flowEngine';

describe('computeZScore', () => {
  it('returns zero until a baseline exists', () => {
    expect(computeZScore([1, 2, 3], 10)).toBe(0);
  });

  it('scores an unusually large value against recent history', () => {
    expect(computeZScore([10, 11, 9, 10, 10], 16)).toBeGreaterThan(2);
  });
});

describe('clusterPrintLevels', () => {
  it('groups nearby prints into the same price bucket', () => {
    const levels = clusterPrintLevels([
      { symbol: 'aapl', price: 190.01, size: 200000 },
      { symbol: 'AAPL', price: 190.03, size: 100000 },
      { symbol: 'AAPL', price: 194.00, size: 25000 },
    ], 0.05);

    expect(levels).toHaveLength(2);
    expect(levels[0]).toMatchObject({ symbol: 'AAPL', printCount: 2, totalSize: 300000 });
  });
});

describe('rowsToCsv', () => {
  it('escapes quotes and serializes dates', () => {
    const csv = rowsToCsv([
      {
        id: 'id"1',
        timestamp: new Date('2026-06-17T12:00:00Z'),
        symbol: 'NVDA',
        direction: 'BUY',
        size: 100000,
        price: 900,
        value: 90000000,
      },
    ]);

    expect(csv).toContain('"id""1"');
    expect(csv).toContain('"2026-06-17T12:00:00.000Z"');
  });
});

