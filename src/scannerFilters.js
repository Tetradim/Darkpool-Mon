export const SCANNER_SIDE_FILTERS = ['ALL', 'BUY', 'SELL'];
export const DEFAULT_UNUSUAL_ZSCORE = 2;

const normalizeSide = (side) => {
  const normalized = String(side || 'ALL').toUpperCase();
  return SCANNER_SIDE_FILTERS.includes(normalized) ? normalized : 'ALL';
};

const meetsConfidenceFloor = (print, minConfidence) => {
  const floor = Number(minConfidence || 0);
  if (floor <= 0) return true;
  const confidence = Number(print?.confidence);
  return Number.isFinite(confidence) && confidence >= floor;
};

const matchesSymbolQuery = (print, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  if (!normalizedQuery) return true;
  return String(print?.symbol || '').toUpperCase().includes(normalizedQuery);
};

const meetsUnusualThreshold = (print, unusualOnly, minAbsZScore) => {
  if (!unusualOnly) return true;
  const threshold = Number(minAbsZScore || DEFAULT_UNUSUAL_ZSCORE);
  const zScore = Number(print?.z_score);
  return Number.isFinite(zScore) && Math.abs(zScore) >= threshold;
};

export const filterScannerPrints = (prints = [], filters = {}) => {
  const side = normalizeSide(filters.side);
  const minConfidence = Number(filters.minConfidence || 0);
  const query = filters.query;
  const unusualOnly = Boolean(filters.unusualOnly);
  const minAbsZScore = Number(filters.minAbsZScore || DEFAULT_UNUSUAL_ZSCORE);

  return prints.filter((print) => {
    const sideMatches = side === 'ALL' || String(print?.side || '').toUpperCase() === side;
    return (
      sideMatches &&
      matchesSymbolQuery(print, query) &&
      meetsConfidenceFloor(print, minConfidence) &&
      meetsUnusualThreshold(print, unusualOnly, minAbsZScore)
    );
  });
};

export const summarizeScannerPrints = (prints = [], options = {}) => {
  const minAbsZScore = Number(options.minAbsZScore || DEFAULT_UNUSUAL_ZSCORE);
  const highConfidence = Number(options.highConfidence || 0.9);
  const symbolCounts = new Map();

  let buyCount = 0;
  let sellCount = 0;
  let unusualCount = 0;
  let highConfidenceCount = 0;

  prints.forEach((print) => {
    const side = String(print?.side || '').toUpperCase();
    if (side === 'BUY') buyCount += 1;
    if (side === 'SELL') sellCount += 1;

    const zScore = Number(print?.z_score);
    if (Number.isFinite(zScore) && Math.abs(zScore) >= minAbsZScore) {
      unusualCount += 1;
    }

    const confidence = Number(print?.confidence);
    if (Number.isFinite(confidence) && confidence >= highConfidence) {
      highConfidenceCount += 1;
    }

    const symbol = String(print?.symbol || '').toUpperCase();
    if (symbol) {
      symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
    }
  });

  let topSymbol = { symbol: 'N/A', printCount: 0 };
  symbolCounts.forEach((printCount, symbol) => {
    if (
      printCount > topSymbol.printCount ||
      (printCount === topSymbol.printCount && symbol < topSymbol.symbol)
    ) {
      topSymbol = { symbol, printCount };
    }
  });

  return {
    total: prints.length,
    buyCount,
    sellCount,
    unusualCount,
    highConfidenceCount,
    topSymbol,
    pressure: buyCount > sellCount ? 'buy' : sellCount > buyCount ? 'sell' : 'neutral',
  };
};
