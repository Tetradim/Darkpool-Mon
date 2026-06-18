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
