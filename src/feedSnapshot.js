const getNotional = (row) => {
  const explicitValue = Number(row?.value ?? row?.notional);
  if (Number.isFinite(explicitValue)) return explicitValue;

  const size = Number(row?.size || 0);
  const price = Number(row?.price || 0);
  return size * price;
};

const formatMillions = (value) => `$${(Number(value || 0) / 1000000).toFixed(1)}M`;

const formatThousands = (value) => `${(Number(value || 0) / 1000).toFixed(1)}K`;

export const summarizeFeedSnapshot = (rows = []) => {
  const transactions = Array.isArray(rows) ? rows : [];
  const count = transactions.length;
  const totalNotional = transactions.reduce((acc, row) => acc + getNotional(row), 0);
  const buyNotional = transactions
    .filter((row) => row.direction === 'BUY')
    .reduce((acc, row) => acc + getNotional(row), 0);
  const sellNotional = transactions
    .filter((row) => row.direction === 'SELL')
    .reduce((acc, row) => acc + getNotional(row), 0);
  const largest = transactions.reduce((current, row) => (
    !current || getNotional(row) > getNotional(current) ? row : current
  ), null);

  return {
    count,
    totalNotional,
    buyNotional,
    sellNotional,
    buyRatio: totalNotional > 0 ? Math.round((buyNotional / totalNotional) * 100) : 0,
    sellRatio: totalNotional > 0 ? Math.round((sellNotional / totalNotional) * 100) : 0,
    largest,
  };
};

export const buildFeedSnapshotCards = (rows = []) => {
  const summary = summarizeFeedSnapshot(rows);

  return [
    {
      label: 'Matched',
      value: `${summary.count} ${summary.count === 1 ? 'print' : 'prints'}`,
      detail: 'Current filters',
    },
    {
      label: 'Notional',
      value: formatMillions(summary.totalNotional),
      detail: 'Filtered tape',
    },
    {
      label: 'Buy / Sell',
      value: `${summary.buyRatio}% / ${summary.sellRatio}%`,
      detail: 'By notional',
    },
    summary.largest
      ? {
        label: 'Largest',
        value: `${summary.largest.symbol} ${formatMillions(getNotional(summary.largest))}`,
        detail: `${summary.largest.direction} ${formatThousands(summary.largest.size)} sh`,
      }
      : {
        label: 'Largest',
        value: 'None',
        detail: 'No print in view',
      },
  ];
};
