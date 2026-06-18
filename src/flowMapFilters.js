const HOTSPOT_SCORE = 70;

const normalizeScore = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const matchesSymbolQuery = (cell, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  if (!normalizedQuery) return true;
  return String(cell?.symbol || '').toUpperCase().includes(normalizedQuery);
};

export const filterHeatmapCells = (cells = [], filters = {}) => {
  const minScore = Math.max(0, normalizeScore(filters.minScore));
  return cells.filter((cell) => {
    return matchesSymbolQuery(cell, filters.query) && normalizeScore(cell?.score) >= minScore;
  });
};

export const summarizeHeatmapCells = (cells = []) => {
  if (cells.length === 0) {
    return {
      activeSymbols: 0,
      hotspotCount: 0,
      totalVolume: 0,
      averageScore: 0,
      topCell: { symbol: 'N/A', bucket: 0, score: 0, volume: 0 },
      topSymbol: { symbol: 'N/A', score: 0, volume: 0 },
    };
  }

  const symbols = new Set();
  const bySymbol = new Map();
  let hotspotCount = 0;
  let totalVolume = 0;
  let totalScore = 0;
  let topCell = { symbol: 'N/A', bucket: 0, score: 0, volume: 0 };

  cells.forEach((cell) => {
    const symbol = String(cell?.symbol || '').trim().toUpperCase();
    const score = normalizeScore(cell?.score);
    const volume = Number(cell?.volume || 0);
    const bucket = Number(cell?.bucket || 0);

    if (symbol) symbols.add(symbol);
    if (score >= HOTSPOT_SCORE) hotspotCount += 1;
    totalVolume += Number.isFinite(volume) ? volume : 0;
    totalScore += score;
    if (score > topCell.score) {
      topCell = { symbol: symbol || 'N/A', bucket, score, volume: Number.isFinite(volume) ? volume : 0 };
    }

    if (symbol) {
      const current = bySymbol.get(symbol) || { symbol, score: 0, volume: 0 };
      current.score += score;
      current.volume += Number.isFinite(volume) ? volume : 0;
      bySymbol.set(symbol, current);
    }
  });

  const topSymbol = Array.from(bySymbol.values()).sort((left, right) => {
    return right.score - left.score || right.volume - left.volume;
  })[0] || { symbol: 'N/A', score: 0, volume: 0 };

  return {
    activeSymbols: symbols.size,
    hotspotCount,
    totalVolume,
    averageScore: Math.round(totalScore / cells.length),
    topCell,
    topSymbol,
  };
};
