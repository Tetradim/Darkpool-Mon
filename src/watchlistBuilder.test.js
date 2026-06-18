import { describe, expect, it } from 'vitest';

import {
  buildWatchlistCreateUrl,
  normalizeCreatedWatchlist,
  parseWatchlistSymbols,
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
