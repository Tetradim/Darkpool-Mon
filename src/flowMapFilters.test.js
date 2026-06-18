import { describe, expect, it } from 'vitest';

import { filterHeatmapCells, summarizeHeatmapCells } from './flowMapFilters';

describe('filterHeatmapCells', () => {
  const cells = [
    { symbol: 'NVDA', bucket: 1, score: 84, volume: 1200000 },
    { symbol: 'NVDA', bucket: 2, score: 45, volume: 300000 },
    { symbol: 'AAPL', bucket: 1, score: 63, volume: 700000 },
    { symbol: 'MSFT', bucket: 3, score: 28, volume: 500000 },
  ];

  it('filters heatmap cells by symbol query and minimum score', () => {
    expect(filterHeatmapCells(cells, { query: 'nv', minScore: 50 })).toEqual([
      { symbol: 'NVDA', bucket: 1, score: 84, volume: 1200000 },
    ]);
  });

  it('treats empty filters as all cells', () => {
    expect(filterHeatmapCells(cells, {})).toEqual(cells);
  });

  it('normalizes malformed minimum scores to zero', () => {
    expect(filterHeatmapCells(cells, { minScore: 'bad' })).toEqual(cells);
  });
});

describe('summarizeHeatmapCells', () => {
  it('summarizes hotspots, volume, top symbol, and average score', () => {
    expect(
      summarizeHeatmapCells([
        { symbol: 'NVDA', bucket: 1, score: 84, volume: 1200000 },
        { symbol: 'NVDA', bucket: 2, score: 45, volume: 300000 },
        { symbol: 'AAPL', bucket: 1, score: 63, volume: 700000 },
      ])
    ).toEqual({
      activeSymbols: 2,
      hotspotCount: 1,
      totalVolume: 2200000,
      averageScore: 64,
      topCell: { symbol: 'NVDA', bucket: 1, score: 84, volume: 1200000 },
      topSymbol: { symbol: 'NVDA', score: 129, volume: 1500000 },
    });
  });

  it('returns stable empty-state summary values', () => {
    expect(summarizeHeatmapCells([])).toEqual({
      activeSymbols: 0,
      hotspotCount: 0,
      totalVolume: 0,
      averageScore: 0,
      topCell: { symbol: 'N/A', bucket: 0, score: 0, volume: 0 },
      topSymbol: { symbol: 'N/A', score: 0, volume: 0 },
    });
  });
});
