export const REPLAY_SIDE_FILTERS = ['ALL', 'BUY', 'SELL'];

const normalizeSide = (side) => {
  const normalized = String(side || 'ALL').toUpperCase();
  return REPLAY_SIDE_FILTERS.includes(normalized) ? normalized : 'ALL';
};

const matchesQuery = (event, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  if (!normalizedQuery) return true;
  return String(event?.symbol || '').toUpperCase().includes(normalizedQuery);
};

const meetsMinimumSize = (event, minSize) => {
  const threshold = Number(minSize || 0);
  if (threshold <= 0) return true;
  return Number(event?.size || 0) >= threshold;
};

const eventNotional = (event) => Number(event?.size || 0) * Number(event?.price || 0);

export const filterReplayEvents = (events = [], filters = {}) => {
  const side = normalizeSide(filters.side);
  return events.filter((event) => {
    const sideMatches = side === 'ALL' || String(event?.side || '').toUpperCase() === side;
    return sideMatches && matchesQuery(event, filters.query) && meetsMinimumSize(event, filters.minSize);
  });
};

export const summarizeReplayEvents = (events = []) => {
  const bySymbol = new Map();
  let totalNotional = 0;
  let buyCount = 0;
  let sellCount = 0;

  events.forEach((event) => {
    const symbol = String(event?.symbol || '').trim().toUpperCase();
    const notional = eventNotional(event);
    const side = String(event?.side || '').toUpperCase();
    totalNotional += notional;
    if (side === 'BUY') buyCount += 1;
    if (side === 'SELL') sellCount += 1;

    if (symbol) {
      const current = bySymbol.get(symbol) || { symbol, count: 0, notional: 0 };
      current.count += 1;
      current.notional += notional;
      bySymbol.set(symbol, current);
    }
  });

  const topSymbol = Array.from(bySymbol.values()).sort((left, right) => {
    return right.notional - left.notional || right.count - left.count;
  })[0] || { symbol: 'N/A', count: 0, notional: 0 };

  return {
    totalEvents: events.length,
    totalNotional,
    buyCount,
    sellCount,
    topSymbol,
  };
};
