export const computeZScore = (values, nextValue) => {
  if (!Array.isArray(values) || values.length < 5) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (nextValue - mean) / stdDev;
};

const bucketPrice = (price, bucketSize) => Math.floor(price / bucketSize) * bucketSize;

export const clusterPrintLevels = (prints, bucketSize = 0.1) => {
  if (bucketSize <= 0) throw new Error('bucketSize must be positive');
  const groups = new Map();

  prints.forEach((print) => {
    const symbol = String(print.symbol || '').toUpperCase();
    const bucket = bucketPrice(Number(print.price), bucketSize).toFixed(2);
    const key = `${symbol}:${bucket}`;
    groups.set(key, [...(groups.get(key) || []), { ...print, symbol }]);
  });

  return Array.from(groups.entries()).map(([key, rows]) => {
    const [symbol, bucket] = key.split(':');
    const totalSize = rows.reduce((acc, row) => acc + Number(row.size || 0), 0);
    const notional = rows.reduce((acc, row) => acc + Number(row.size || 0) * Number(row.price || 0), 0);
    return {
      symbol,
      price: Number(bucket),
      printCount: rows.length,
      totalSize,
      notional,
      strength: Math.min(100, rows.length * 8 + Math.log10(Math.max(notional, 1)) * 8),
    };
  }).sort((a, b) => b.strength - a.strength);
};

export const rowsToCsv = (rows) => {
  const header = ['id', 'timestamp', 'symbol', 'direction', 'size', 'price', 'notional'];
  const body = rows.map((row) => [
    row.id,
    row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    row.symbol,
    row.direction,
    row.size,
    row.price,
    row.value ?? row.notional,
  ]);

  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
};
