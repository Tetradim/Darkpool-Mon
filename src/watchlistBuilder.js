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

const matchesWatchlistQuery = (watchlist, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  if (!normalizedQuery) return true;
  return [
    watchlist?.name,
    watchlist?.owner,
    ...(Array.isArray(watchlist?.symbols) ? watchlist.symbols : []),
  ].some((value) => String(value || '').toUpperCase().includes(normalizedQuery));
};

const byNewest = (left, right) => {
  return new Date(right?.created_at || 0).getTime() - new Date(left?.created_at || 0).getTime();
};

const byName = (left, right) => {
  return String(left?.name || '').localeCompare(String(right?.name || ''), undefined, { sensitivity: 'base' });
};

const bySymbolCount = (left, right) => {
  return (right?.symbols?.length || 0) - (left?.symbols?.length || 0) || byName(left, right);
};

export const filterWatchlists = (watchlists = [], filters = {}) => {
  const sortBy = String(filters.sortBy || 'newest').toLowerCase();
  const sorters = {
    newest: byNewest,
    name: byName,
    symbol_count: bySymbolCount,
  };
  const sorter = sorters[sortBy] || sorters.newest;

  return watchlists
    .filter((watchlist) => matchesWatchlistQuery(watchlist, filters.query))
    .slice()
    .sort(sorter);
};

export const summarizeWatchlists = (watchlists = []) => {
  const uniqueSymbols = new Set();
  const symbolListCounts = new Map();
  let filterCount = 0;
  let totalSymbolSlots = 0;
  let largestList = { name: 'N/A', symbolCount: 0 };

  watchlists.forEach((watchlist) => {
    const symbols = Array.isArray(watchlist?.symbols) ? watchlist.symbols : [];
    const symbolsInList = new Set(
      symbols
        .map((symbol) => String(symbol || '').toUpperCase())
        .filter(Boolean)
    );

    totalSymbolSlots += symbolsInList.size;
    symbolsInList.forEach((symbol) => {
      uniqueSymbols.add(symbol);
      symbolListCounts.set(symbol, (symbolListCounts.get(symbol) || 0) + 1);
    });
    filterCount += Array.isArray(watchlist?.filters) ? watchlist.filters.length : 0;
    if (symbols.length > largestList.symbolCount) {
      largestList = { name: watchlist?.name || 'Untitled', symbolCount: symbols.length };
    }
  });

  let mostRepeatedSymbol = { symbol: 'N/A', listCount: 0 };
  symbolListCounts.forEach((listCount, symbol) => {
    if (
      listCount > mostRepeatedSymbol.listCount ||
      (listCount === mostRepeatedSymbol.listCount && symbol < mostRepeatedSymbol.symbol)
    ) {
      mostRepeatedSymbol = { symbol, listCount };
    }
  });

  return {
    listCount: watchlists.length,
    uniqueSymbolCount: uniqueSymbols.size,
    totalSymbolSlots,
    overlapSymbolCount: Array.from(symbolListCounts.values()).filter((listCount) => listCount > 1).length,
    filterCount,
    largestList,
    mostRepeatedSymbol,
  };
};
