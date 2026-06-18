import { describe, expect, it } from 'vitest';

import { SCANNER_SIDE_FILTERS, filterScannerPrints, summarizeScannerPrints } from './scannerFilters';

describe('filterScannerPrints', () => {
  const prints = [
    { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
    { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
    { symbol: 'NVDA', side: 'BUY', confidence: 0.72, z_score: 1.8 },
    { symbol: 'TSLA', side: 'SELL' },
  ];

  it('exposes the scanner side filters in stable UI order', () => {
    expect(SCANNER_SIDE_FILTERS).toEqual(['ALL', 'BUY', 'SELL']);
  });

  it('filters prints by side and minimum confidence', () => {
    expect(filterScannerPrints(prints, { side: 'BUY', minConfidence: 0.8 })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
    ]);
  });

  it('treats unknown side filters as ALL while still applying confidence', () => {
    expect(filterScannerPrints(prints, { side: 'BLOCK', minConfidence: 0.9 })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
    ]);
  });

  it('keeps prints with missing confidence only when the floor is zero', () => {
    expect(filterScannerPrints(prints, { side: 'SELL', minConfidence: 0 })).toEqual([
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
      { symbol: 'TSLA', side: 'SELL' },
    ]);
    expect(filterScannerPrints(prints, { side: 'SELL', minConfidence: 0.1 })).toEqual([
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
    ]);
  });

  it('filters by case-insensitive symbol search while preserving other filters', () => {
    expect(filterScannerPrints(prints, { query: ' ms ', side: 'SELL', minConfidence: 0.8 })).toEqual([
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
    ]);
    expect(filterScannerPrints(prints, { query: 'a' })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
      { symbol: 'NVDA', side: 'BUY', confidence: 0.72, z_score: 1.8 },
      { symbol: 'TSLA', side: 'SELL' },
    ]);
  });

  it('keeps only unusual prints when unusual mode is enabled', () => {
    expect(filterScannerPrints(prints, { unusualOnly: true, minAbsZScore: 2 })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
    ]);
  });

  it('summarizes scanner pressure for operator status cards', () => {
    expect(summarizeScannerPrints([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94, z_score: 2.4 },
      { symbol: 'AAPL', side: 'SELL', confidence: 0.91, z_score: -1.2 },
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88, z_score: -2.7 },
      { symbol: 'NVDA', side: 'BUY', confidence: 0.72, z_score: 1.8 },
      { symbol: 'TSLA', side: 'SELL' },
    ], { minAbsZScore: 2, highConfidence: 0.9 })).toEqual({
      total: 5,
      buyCount: 2,
      sellCount: 3,
      unusualCount: 2,
      highConfidenceCount: 2,
      topSymbol: { symbol: 'AAPL', printCount: 2 },
      pressure: 'sell',
    });
  });

  it('returns stable empty scanner summary values', () => {
    expect(summarizeScannerPrints([])).toEqual({
      total: 0,
      buyCount: 0,
      sellCount: 0,
      unusualCount: 0,
      highConfidenceCount: 0,
      topSymbol: { symbol: 'N/A', printCount: 0 },
      pressure: 'neutral',
    });
  });
});
