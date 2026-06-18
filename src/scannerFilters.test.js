import { describe, expect, it } from 'vitest';

import { SCANNER_SIDE_FILTERS, filterScannerPrints } from './scannerFilters';

describe('filterScannerPrints', () => {
  const prints = [
    { symbol: 'AAPL', side: 'BUY', confidence: 0.94 },
    { symbol: 'MSFT', side: 'SELL', confidence: 0.88 },
    { symbol: 'NVDA', side: 'BUY', confidence: 0.72 },
    { symbol: 'TSLA', side: 'SELL' },
  ];

  it('exposes the scanner side filters in stable UI order', () => {
    expect(SCANNER_SIDE_FILTERS).toEqual(['ALL', 'BUY', 'SELL']);
  });

  it('filters prints by side and minimum confidence', () => {
    expect(filterScannerPrints(prints, { side: 'BUY', minConfidence: 0.8 })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94 },
    ]);
  });

  it('treats unknown side filters as ALL while still applying confidence', () => {
    expect(filterScannerPrints(prints, { side: 'BLOCK', minConfidence: 0.9 })).toEqual([
      { symbol: 'AAPL', side: 'BUY', confidence: 0.94 },
    ]);
  });

  it('keeps prints with missing confidence only when the floor is zero', () => {
    expect(filterScannerPrints(prints, { side: 'SELL', minConfidence: 0 })).toEqual([
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88 },
      { symbol: 'TSLA', side: 'SELL' },
    ]);
    expect(filterScannerPrints(prints, { side: 'SELL', minConfidence: 0.1 })).toEqual([
      { symbol: 'MSFT', side: 'SELL', confidence: 0.88 },
    ]);
  });
});
