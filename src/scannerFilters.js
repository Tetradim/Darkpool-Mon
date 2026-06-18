export const SCANNER_SIDE_FILTERS = ['ALL', 'BUY', 'SELL'];

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

export const filterScannerPrints = (prints = [], filters = {}) => {
  const side = normalizeSide(filters.side);
  const minConfidence = Number(filters.minConfidence || 0);

  return prints.filter((print) => {
    const sideMatches = side === 'ALL' || String(print?.side || '').toUpperCase() === side;
    return sideMatches && meetsConfidenceFloor(print, minConfidence);
  });
};
