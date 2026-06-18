const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

export const parseWatchlistSymbols = (value = '') => {
  const seen = new Set();
  return String(value)
    .split(/[\s,]+/)
    .map((item) => item.trim().replace(/^\$/, '').toUpperCase())
    .filter((item) => TICKER_PATTERN.test(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

export const validateWatchlistDraft = ({ name = '', symbolsText = '' } = {}) => {
  const trimmedName = String(name).trim();
  const symbols = parseWatchlistSymbols(symbolsText);
  const errors = [];

  if (!trimmedName) {
    errors.push('Name is required.');
  }
  if (symbols.length === 0) {
    errors.push('Add at least one valid ticker.');
  }

  return {
    errors,
    name: trimmedName,
    symbols,
  };
};

export const buildWatchlistCreateUrl = ({ name, symbols }) => {
  const params = new URLSearchParams();
  params.set('name', name);
  for (const symbol of symbols) {
    params.append('symbols', symbol);
  }
  return `/watchlists?${params.toString()}`;
};

export const normalizeCreatedWatchlist = (watchlist) => ({
  id: watchlist.id,
  name: watchlist.name,
  owner: watchlist.owner || 'user',
  symbols: Array.isArray(watchlist.symbols) ? watchlist.symbols : [],
  filters: Array.isArray(watchlist.filters) ? watchlist.filters : [],
  created_at: watchlist.created_at || new Date().toISOString(),
});
