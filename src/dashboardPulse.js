const EMPTY_BIAS = {
  state: 'neutral',
  label: 'Balanced tape',
  buyRatio: 50,
  sellRatio: 50,
  summary: 'Waiting for qualifying prints',
  toneClass: 'border-dark-600 bg-dark-800 text-gray-300',
};

const BIAS_TONES = {
  buy: 'border-green-500/30 bg-green-500/10 text-green-200',
  sell: 'border-red-500/30 bg-red-500/10 text-red-200',
  neutral: EMPTY_BIAS.toneClass,
};

const formatMillions = (value) => `$${(value / 1000000).toFixed(1)}M`;

const roundRatio = (value) => Math.round(value * 10) / 10;

const getDirection = (transaction) => String(transaction?.direction || '').toUpperCase();

const createSymbolSummary = (symbol) => ({
  symbol,
  trades: 0,
  notional: 0,
  buyNotional: 0,
  sellNotional: 0,
  whaleCount: 0,
});

const summarizeBias = (buyNotional, sellNotional) => {
  const total = buyNotional + sellNotional;
  if (total <= 0) return EMPTY_BIAS;

  const buyRatio = roundRatio((buyNotional / total) * 100);
  const sellRatio = roundRatio(100 - buyRatio);
  const state = buyRatio >= 60 ? 'buy' : sellRatio >= 60 ? 'sell' : 'neutral';
  const label = state === 'buy' ? 'Buy pressure' : state === 'sell' ? 'Sell pressure' : 'Balanced tape';

  return {
    state,
    label,
    buyRatio,
    sellRatio,
    summary: `${formatMillions(buyNotional)} buy vs ${formatMillions(sellNotional)} sell`,
    toneClass: BIAS_TONES[state],
  };
};

const summarizeLeader = (transactions) => {
  const bySymbol = transactions.reduce((acc, transaction) => {
    const symbol = String(transaction?.symbol || '').trim().toUpperCase();
    if (!symbol) return acc;

    const value = Number(transaction?.value || 0);
    const direction = getDirection(transaction);
    const existing = acc[symbol] || createSymbolSummary(symbol);

    existing.trades += 1;
    existing.notional += Number.isFinite(value) ? value : 0;
    if (direction === 'BUY') existing.buyNotional += value;
    if (direction === 'SELL') existing.sellNotional += value;
    acc[symbol] = existing;
    return acc;
  }, {});

  const leader = Object.values(bySymbol).sort((a, b) => b.notional - a.notional)[0];
  if (!leader) {
    return {
      symbol: 'N/A',
      label: 'No leader',
      trades: 0,
      notional: 0,
      dominantSide: 'N/A',
    };
  }

  return {
    symbol: leader.symbol,
    label: `${leader.symbol} leading`,
    trades: leader.trades,
    notional: leader.notional,
    dominantSide: leader.buyNotional >= leader.sellNotional ? 'BUY' : 'SELL',
  };
};

const summarizeFocusQueue = (transactions, whaleThresholdK, focusLimit) => {
  const thresholdShares = Math.max(0, Number(whaleThresholdK || 0)) * 1000;
  const limit = Math.max(0, Number(focusLimit || 3));
  const bySymbol = transactions.reduce((acc, transaction) => {
    const symbol = String(transaction?.symbol || '').trim().toUpperCase();
    if (!symbol) return acc;

    const value = Number(transaction?.value || 0);
    const size = Number(transaction?.size || 0);
    const direction = getDirection(transaction);
    const existing = acc[symbol] || createSymbolSummary(symbol);

    existing.trades += 1;
    existing.notional += Number.isFinite(value) ? value : 0;
    if (direction === 'BUY') existing.buyNotional += value;
    if (direction === 'SELL') existing.sellNotional += value;
    if (size >= thresholdShares) existing.whaleCount += 1;
    acc[symbol] = existing;
    return acc;
  }, {});

  return Object.values(bySymbol)
    .sort((a, b) => b.notional - a.notional)
    .slice(0, limit)
    .map((summary) => {
      const buyRatio = summary.notional > 0 ? roundRatio((summary.buyNotional / summary.notional) * 100) : 50;
      const dominantSide = summary.buyNotional >= summary.sellNotional ? 'BUY' : 'SELL';
      const skew =
        buyRatio >= 60 ? 'buy skew' :
        buyRatio <= 40 ? 'sell skew' :
        'mixed pressure';
      const toneClass =
        buyRatio >= 60 ? 'border-green-500/30 bg-green-500/10 text-green-200' :
        buyRatio <= 40 ? 'border-red-500/30 bg-red-500/10 text-red-200' :
        'border-yellow-500/30 bg-yellow-500/10 text-yellow-200';

      return {
        symbol: summary.symbol,
        notional: summary.notional,
        trades: summary.trades,
        whaleCount: summary.whaleCount,
        dominantSide,
        buyRatio,
        label: `${summary.symbol} ${skew}`,
        toneClass,
      };
    });
};

const summarizeWhales = (transactions, whaleThresholdK) => {
  const thresholdShares = Math.max(0, Number(whaleThresholdK || 0)) * 1000;
  const count = transactions.filter((transaction) => Number(transaction?.size || 0) >= thresholdShares).length;

  return {
    count,
    thresholdShares,
    label: count === 0 ? 'No whale prints' : `${count} whale print${count === 1 ? '' : 's'}`,
    toneClass: count > 0
      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
      : 'border-dark-600 bg-dark-800 text-gray-300',
  };
};

const summarizeLatestAlert = (alerts) => {
  const latestAlert = alerts[0];
  if (!latestAlert) {
    return {
      label: 'No alerts',
      symbol: 'N/A',
      reason: 'Alerts appear when the simulation detects whale prints or z-score spikes.',
    };
  }

  return {
    label: 'Latest alert',
    symbol: String(latestAlert.symbol || 'N/A').toUpperCase(),
    reason: latestAlert.reason || 'Alert triggered without a reason.',
  };
};

export const summarizeDashboardPulse = (transactions = [], alerts = [], options = {}) => {
  const whaleThresholdK = Number(options.whaleThresholdK ?? 50);
  const focusLimit = Number(options.focusLimit ?? 3);
  const totals = transactions.reduce(
    (acc, transaction) => {
      const value = Number(transaction?.value || 0);
      if (!Number.isFinite(value) || value <= 0) return acc;

      acc.totalNotional += value;
      const direction = getDirection(transaction);
      if (direction === 'BUY') acc.buyNotional += value;
      if (direction === 'SELL') acc.sellNotional += value;
      return acc;
    },
    { totalNotional: 0, buyNotional: 0, sellNotional: 0 }
  );

  return {
    totalNotional: totals.totalNotional,
    bias: summarizeBias(totals.buyNotional, totals.sellNotional),
    leader: summarizeLeader(transactions),
    whales: summarizeWhales(transactions, whaleThresholdK),
    focusQueue: summarizeFocusQueue(transactions, whaleThresholdK, focusLimit),
    latestAlert: summarizeLatestAlert(alerts),
  };
};
