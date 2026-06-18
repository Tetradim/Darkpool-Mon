import { describe, expect, it } from 'vitest';

import {
  buildWatchlistCreateUrl,
  filterWatchlists,
  normalizeCreatedWatchlist,
  parseWatchlistSymbols,
  summarizeWatchlists,
  validateWatchlistDraft,
} from './watchlistBuilder';

describe('parseWatchlistSymbols', () => {
  it('normalizes comma, space, and newline separated symbols into unique uppercase tickers', () => {
    expect(parseWatchlistSymbols('aapl, msft\nNVDA $tsla msft')).toEqual([
      'AAPL',
      'MSFT',
      'NVDA',
      'TSLA',
    ]);
  });

  it('drops malformed entries instead of sending them to the backend', () => {
    expect(parseWatchlistSymbols('AAPL, ???, BRK.B, bad/value, x')).toEqual(['AAPL', 'BRK.B', 'X']);
  });
});

describe('validateWatchlistDraft', () => {
  it('returns a clean draft when the name and symbols are usable', () => {
    expect(validateWatchlistDraft({ name: 'AI momentum', symbolsText: 'nvda amd smci' })).toEqual({
      errors: [],
      name: 'AI momentum',
      symbols: ['NVDA', 'AMD', 'SMCI'],
    });
  });

  it('reports missing name and missing symbols', () => {
    expect(validateWatchlistDraft({ name: ' ', symbolsText: '???, /bad' })).toEqual({
      errors: ['Name is required.', 'Add at least one valid ticker.'],
      name: '',
      symbols: [],
    });
  });
});

describe('buildWatchlistCreateUrl', () => {
  it('serializes repeated symbol query params for the FastAPI watchlists route', () => {
    const url = buildWatchlistCreateUrl({ name: 'Desk review', symbols: ['AAPL', 'NVDA'] });

    expect(url).toBe('/watchlists?name=Desk+review&symbols=AAPL&symbols=NVDA');
  });
});

describe('normalizeCreatedWatchlist', () => {
  it('fills UI defaults missing from the create response', () => {
    expect(
      normalizeCreatedWatchlist({
        id: 'abc123',
        name: 'Desk review',
        symbols: ['AAPL'],
        created_at: '2026-06-18T12:00:00',
      })
    ).toEqual({
      id: 'abc123',
      name: 'Desk review',
      owner: 'user',
      symbols: ['AAPL'],
      filters: [],
      created_at: '2026-06-18T12:00:00',
    });
  });
});

describe('filterWatchlists', () => {
  const watchlists = [
    {
      id: '1',
      name: 'AI Momentum',
      owner: 'desk',
      symbols: ['NVDA', 'AMD', 'SMCI'],
      filters: ['min_notional'],
      created_at: '2026-06-18T12:00:00Z',
    },
    {
      id: '2',
      name: 'Mega cap review',
      owner: 'pm',
      symbols: ['AAPL', 'MSFT'],
      filters: [],
      created_at: '2026-06-17T12:00:00Z',
    },
    {
      id: '3',
      name: 'EV squeeze',
      owner: 'desk',
      symbols: ['TSLA', 'RIVN', 'LCID', 'NIO'],
      filters: ['z_score', 'side'],
      created_at: '2026-06-16T12:00:00Z',
    },
  ];

  it('filters lists by query across name, owner, and symbols', () => {
    expect(filterWatchlists(watchlists, { query: 'nv' }).map((watchlist) => watchlist.id)).toEqual(['1']);
    expect(filterWatchlists(watchlists, { query: 'PM' }).map((watchlist) => watchlist.id)).toEqual(['2']);
    expect(filterWatchlists(watchlists, { query: 'squeeze' }).map((watchlist) => watchlist.id)).toEqual(['3']);
  });

  it('sorts lists by newest, name, and symbol count', () => {
    expect(filterWatchlists(watchlists, { sortBy: 'newest' }).map((watchlist) => watchlist.id)).toEqual(['1', '2', '3']);
    expect(filterWatchlists(watchlists, { sortBy: 'name' }).map((watchlist) => watchlist.id)).toEqual(['1', '3', '2']);
    expect(filterWatchlists(watchlists, { sortBy: 'symbol_count' }).map((watchlist) => watchlist.id)).toEqual(['3', '1', '2']);
  });
});

describe('summarizeWatchlists', () => {
  it('summarizes coverage across watchlists', () => {
    expect(
      summarizeWatchlists([
        { name: 'AI Momentum', symbols: ['NVDA', 'AMD', 'SMCI'], filters: ['min_notional'] },
        { name: 'Mega cap review', symbols: ['AAPL', 'MSFT', 'NVDA'], filters: [] },
      ])
    ).toEqual({
      listCount: 2,
      uniqueSymbolCount: 5,
      totalSymbolSlots: 6,
      overlapSymbolCount: 1,
      filterCount: 1,
      largestList: { name: 'AI Momentum', symbolCount: 3 },
      mostRepeatedSymbol: { symbol: 'NVDA', listCount: 2 },
    });
  });

  it('summarizes empty watchlist coverage without blank card values', () => {
    expect(summarizeWatchlists([])).toEqual({
      listCount: 0,
      uniqueSymbolCount: 0,
      totalSymbolSlots: 0,
      overlapSymbolCount: 0,
      filterCount: 0,
      largestList: { name: 'N/A', symbolCount: 0 },
      mostRepeatedSymbol: { symbol: 'N/A', listCount: 0 },
    });
  });
});
