import { useState, useEffect, useRef, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, Pause, Play, Filter,
  DollarSign, Clock, BarChart3, PieChart, Zap, RefreshCw, Bell,
  Download, AlertTriangle
} from 'lucide-react';
import {
  MAG7_STOCKS,
  generateTransaction,
  getWeightedRandomStock,
  generateHistoricalData,
  formatCurrency,
  formatMillionsCurrency,
  formatVolume
} from './dataGenerator';

const STORAGE_KEY = 'darkpool-monitor-settings-v2';
const TIMEFRAME_HOURS = { '1H': 1, '4H': 4, '1D': 24 };

const exportTransactionsToCsv = (rows) => {
  const header = ['id', 'timestamp', 'symbol', 'direction', 'size_millions', 'price', 'notional'];
  const lines = rows.map((row) => [
    row.id,
    row.timestamp.toISOString(),
    row.symbol,
    row.direction,
    row.size,
    row.price,
    row.value,
  ]);

  const csv = [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `darkpool-transactions-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const computeZScore = (values, nextValue) => {
  if (values.length < 5) return 0;
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  return (nextValue - mean) / stdDev;
};

const StockCard = ({ stock, data, isActive, onClick }) => {
  const latestData = data[data.length - 1] || { buyVolume: 0, sellVolume: 0 };
  const totalVolume = latestData.totalVolume || 0;
  const intensity = Math.min(totalVolume / 25, 1);

  const priceChange = data.length > 1
    ? ((data[data.length - 1].price - data[0].price) / data[0].price * 100)
    : 0;

  const isPositive = priceChange >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
      relative overflow-hidden rounded-xl p-4 transition-all duration-300 cursor-pointer text-left
      ${isActive ? 'bg-dark-700 ring-2 ring-accent-cyan' : 'bg-dark-800 hover:bg-dark-700'}
    `}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 opacity-20"
        style={{
          background: `conic-gradient(#00d4ff ${intensity * 360}deg, transparent ${intensity * 360}deg)`,
          borderRadius: '50%',
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-mono font-bold text-lg text-white">{stock.symbol}</h3>
            <p className="text-xs text-gray-500">{stock.name}</p>
          </div>
          <div className={`flex items-center gap-1 ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
            {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="font-mono text-sm font-medium">
              {isPositive ? '+' : ''}
              {priceChange.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-2xl font-bold text-white">
              ${stock.basePrice.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Vol: {formatVolume(totalVolume)}
            </p>
          </div>

          <div className="w-20 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.slice(-20)}>
                <defs>
                  <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="totalVolume"
                  stroke={isPositive ? '#22c55e' : '#ef4444'}
                  fill={`url(#grad-${stock.symbol})`}
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </button>
  );
};

const TransactionItem = ({ transaction, isNew }) => {
  const isBuy = transaction.direction === 'BUY';

  return (
    <div
      className={`
      flex items-center justify-between p-3 rounded-lg bg-dark-800 border border-dark-600
      transition-all duration-300
      ${isNew ? 'animate-pulse bg-dark-700 border-accent-cyan' : ''}
    `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
          w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm
          ${isBuy ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}
        `}
        >
          {transaction.symbol}
        </div>
        <div>
          <p className="font-mono font-semibold text-white">
            {transaction.symbol}
          </p>
          <p className="text-xs text-gray-500">
            {transaction.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-mono font-bold text-white">
          ${formatVolume(transaction.size)}M
        </p>
        <p className={`text-xs font-medium ${isBuy ? 'text-accent-green' : 'text-accent-red'}`}>
          {transaction.direction}
        </p>
      </div>

      <div className="text-right">
        <p className="font-mono text-sm text-gray-400">
          @ ${transaction.price.toFixed(2)}
        </p>
        <p className="font-mono text-sm font-semibold text-white">
          {formatCurrency(transaction.value)}
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedStock, setSelectedStock] = useState('ALL');
  const [timeframe, setTimeframe] = useState('1H');
  const [threshold, setThreshold] = useState(1);
  const [feedSort, setFeedSort] = useState('LATEST');
  const [chartData, setChartData] = useState({});
  const [stockPrices, setStockPrices] = useState(MAG7_STOCKS);
  const [newTransactionId, setNewTransactionId] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const feedRef = useRef(null);

  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      const settings = JSON.parse(persisted);
      setSelectedStock(settings.selectedStock || 'ALL');
      setTimeframe(settings.timeframe || '1H');
      setThreshold(settings.threshold || 1);
      setFeedSort(settings.feedSort || 'LATEST');
      setIsRunning(typeof settings.isRunning === 'boolean' ? settings.isRunning : true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedStock, timeframe, threshold, feedSort, isRunning })
    );
  }, [selectedStock, timeframe, threshold, feedSort, isRunning]);

  useEffect(() => {
    const initialData = {};
    Object.keys(MAG7_STOCKS).forEach((symbol) => {
      initialData[symbol] = generateHistoricalData(symbol, TIMEFRAME_HOURS[timeframe]);
    });
    setChartData(initialData);
  }, [timeframe]);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (!isRunning) return undefined;

    const interval = setInterval(() => {
      const stock = getWeightedRandomStock();
      const transaction = generateTransaction(stock);

      setNewTransactionId(transaction.id);
      setTimeout(() => setNewTransactionId(null), 1000);

      setTransactions((prev) => {
        const symbolSizes = prev.filter((txn) => txn.symbol === transaction.symbol).slice(0, 25).map((txn) => txn.size);
        const zScore = computeZScore(symbolSizes, transaction.size);
        const isWhale = transaction.size >= 25;

        if (isWhale || zScore >= 2.2) {
          const reason = isWhale ? `Whale print ${transaction.size.toFixed(2)}M` : `Unusual size z-score ${zScore.toFixed(2)}`;
          setAlerts((prevAlerts) => [
            {
              id: `${transaction.id}-ALERT`,
              symbol: transaction.symbol,
              direction: transaction.direction,
              size: transaction.size,
              reason,
              timestamp: new Date(),
            },
            ...prevAlerts,
          ].slice(0, 25));
        }

        return [transaction, ...prev].slice(0, 200);
      });

      setStockPrices((prev) => ({
        ...prev,
        [stock.symbol]: {
          ...prev[stock.symbol],
          basePrice: Math.max(
            0.01,
            prev[stock.symbol].basePrice + (transaction.direction === 'BUY' ? 0.05 : -0.05)
          ),
        },
      }));

      setChartData((prev) => {
        const series = prev[stock.symbol] || [];
        const nextPoint = {
          time: Date.now(),
          label: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          buyVolume: transaction.direction === 'BUY' ? transaction.size : 0,
          sellVolume: transaction.direction === 'SELL' ? transaction.size : 0,
          totalVolume: transaction.size,
          price: transaction.price,
        };
        return {
          ...prev,
          [stock.symbol]: [...series.slice(-47), nextPoint],
        };
      });
    }, 1200 + Math.random() * 1100);

    return () => clearInterval(interval);
  }, [isRunning]);

  const filteredTransactions = useMemo(() => {
    const baseFiltered = transactions.filter((transaction) => {
      const stockMatch = selectedStock === 'ALL' || transaction.symbol === selectedStock;
      return stockMatch && transaction.size >= threshold;
    });

    if (feedSort === 'LARGEST') {
      return [...baseFiltered].sort((a, b) => b.size - a.size);
    }

    return baseFiltered;
  }, [transactions, selectedStock, threshold, feedSort]);

  const totalVolume = transactions.reduce((acc, transaction) => acc + transaction.size, 0);
  const buyVolume = transactions.filter((transaction) => transaction.direction === 'BUY').reduce((acc, transaction) => acc + transaction.size, 0);
  const sellVolume = transactions.filter((transaction) => transaction.direction === 'SELL').reduce((acc, transaction) => acc + transaction.size, 0);
  const avgTradeSize = transactions.length ? totalVolume / transactions.length : 0;
  const whaleTrades = transactions.filter((transaction) => transaction.size >= 25).length;
  const buyRatio = totalVolume > 0 ? (buyVolume / totalVolume * 100).toFixed(1) : 50;

  const mainChartData = selectedStock === 'ALL'
    ? Object.keys(MAG7_STOCKS).map((symbol) => {
      const stockTransactions = transactions.filter((transaction) => transaction.symbol === symbol);
      const buyVol = stockTransactions.filter((transaction) => transaction.direction === 'BUY').reduce((acc, transaction) => acc + transaction.size, 0);
      const sellVol = stockTransactions.filter((transaction) => transaction.direction === 'SELL').reduce((acc, transaction) => acc + transaction.size, 0);
      return {
        name: symbol,
        buy: buyVol,
        sell: sellVol,
      };
    })
    : chartData[selectedStock]?.map((point) => ({
      name: point.label,
      buy: point.buyVolume,
      sell: point.sellVolume,
    })) || [];

  return (
    <div className="min-h-screen bg-dark-900 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">DARKPOOL MONITOR</h1>
            <p className="text-xs text-gray-500">Real-time Institutional Activity (MAG7)</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={16} />
            <span className="font-mono text-sm">{currentTime.toLocaleTimeString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-xs text-gray-400">LIVE</span>
          </div>

          <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-1.5">
            <DollarSign size={14} className="text-accent-cyan" />
            <span className="font-mono text-sm text-white">{formatMillionsCurrency(totalVolume)}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${isRunning
                ? 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'}
            `}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            onClick={() => {
              setTransactions([]);
              setAlerts([]);
              setChartData(
                Object.fromEntries(
                  Object.keys(MAG7_STOCKS).map((symbol) => [symbol, generateHistoricalData(symbol, TIMEFRAME_HOURS[timeframe])])
                )
              );
            }}
            className="p-2 rounded-lg bg-dark-800 text-gray-400 hover:text-white transition-all"
            title="Reset simulation"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {['1H', '4H', '1D'].map((frame) => (
            <button
              type="button"
              key={frame}
              onClick={() => setTimeframe(frame)}
              className={`
                px-3 py-1.5 rounded-lg font-mono text-sm transition-all
                ${timeframe === frame
                  ? 'bg-accent-cyan/20 text-accent-cyan'
                  : 'bg-dark-800 text-gray-400 hover:text-white'}
              `}
            >
              {frame}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <select
            value={selectedStock}
            onChange={(event) => setSelectedStock(event.target.value)}
            className="bg-dark-800 text-white rounded-lg px-3 py-1.5 font-mono text-sm border border-dark-600 focus:border-accent-cyan outline-none"
          >
            <option value="ALL">ALL STOCKS</option>
            {Object.values(MAG7_STOCKS).map((stock) => (
              <option key={stock.symbol} value={stock.symbol}>
                {stock.symbol} - {stock.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Min:</span>
          <input
            type="range"
            min="1"
            max="50"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="w-24 accent-accent-cyan"
          />
          <span className="font-mono text-sm text-accent-cyan">${threshold}M</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={feedSort}
            onChange={(event) => setFeedSort(event.target.value)}
            className="bg-dark-800 text-white rounded-lg px-3 py-1.5 font-mono text-sm border border-dark-600 focus:border-accent-cyan outline-none"
          >
            <option value="LATEST">Latest first</option>
            <option value="LARGEST">Largest first</option>
          </select>

          <button
            type="button"
            onClick={() => exportTransactionsToCsv(filteredTransactions)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-800 text-gray-300 hover:text-white transition-all"
            title="Export filtered feed"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        {Object.values(MAG7_STOCKS).map((stock) => (
          <StockCard
            key={stock.symbol}
            stock={stockPrices[stock.symbol] || stock}
            data={chartData[stock.symbol] || []}
            isActive={selectedStock === stock.symbol}
            onClick={() => setSelectedStock(stock.symbol)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-accent-cyan" />
              Transaction Volume
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-accent-green" />
                <span className="text-xs text-gray-500">BUY</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-accent-red" />
                <span className="text-xs text-gray-500">SELL</span>
              </div>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mainChartData.length > 0 ? mainChartData : [{ name: 'No Data', buy: 0, sell: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#8b949e', fontSize: 12 }}
                  axisLine={{ stroke: '#30363d' }}
                />
                <YAxis
                  tick={{ fill: '#8b949e', fontSize: 12 }}
                  axisLine={{ stroke: '#30363d' }}
                  tickFormatter={(value) => `${value}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '8px',
                    color: '#ffffff',
                  }}
                  formatter={(value) => [`${value}M`, '']}
                />
                <Bar dataKey="buy" fill="#22c55e" name="Buy" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sell" fill="#ef4444" name="Sell" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-accent-purple" />
            Summary
          </h2>

          <div className="space-y-4">
            <div className="bg-dark-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">BUY/SELL RATIO</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-dark-900 flex">
                  <div
                    className="h-full bg-accent-green transition-all duration-500"
                    style={{ width: `${buyRatio}%` }}
                  />
                  <div
                    className="h-full bg-accent-red transition-all duration-500"
                    style={{ width: `${100 - buyRatio}%` }}
                  />
                </div>
                <span className="font-mono text-sm text-white">{buyRatio}%</span>
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-accent-green">BUY {buyRatio}%</span>
                <span className="text-accent-red">SELL {100 - buyRatio}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">TOTAL VOLUME</p>
                <p className="font-mono text-xl font-bold text-white">{formatVolume(totalVolume)}M</p>
              </div>
              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">AVG TRADE</p>
                <p className="font-mono text-xl font-bold text-white">{avgTradeSize.toFixed(2)}M</p>
              </div>
              <div className="bg-accent-yellow/10 rounded-lg p-3">
                <p className="text-xs text-accent-yellow mb-1">WHALE PRINTS</p>
                <p className="font-mono text-lg font-bold text-accent-yellow">{whaleTrades}</p>
              </div>
              <div className="bg-accent-cyan/10 rounded-lg p-3">
                <p className="text-xs text-accent-cyan mb-1">TRANSACTIONS</p>
                <p className="font-mono text-lg font-bold text-accent-cyan">{transactions.length}</p>
              </div>
            </div>

            <div className="bg-dark-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-3">MOST ACTIVE</p>
              {Object.entries(
                transactions.reduce((acc, transaction) => {
                  acc[transaction.symbol] = (acc[transaction.symbol] || 0) + transaction.size;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([symbol, volume]) => (
                  <div key={symbol} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                    <span className="font-mono font-semibold text-white">{symbol}</span>
                    <span className="font-mono text-sm text-accent-cyan">{formatVolume(volume)}M</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-dark-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap size={20} className="text-accent-yellow" />
              Live Transaction Feed
            </h2>
            <span className="text-xs text-gray-500">Showing {filteredTransactions.length} transactions</span>
          </div>

          <div
            ref={feedRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto"
          >
            {filteredTransactions.length === 0 ? (
              <div className="col-span-full text-center py-8 text-gray-500">
                No transactions matching current filters
              </div>
            ) : (
              filteredTransactions.slice(0, 36).map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  isNew={newTransactionId === transaction.id}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-dark-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Bell size={20} className="text-accent-yellow" />
            Smart Alerts
          </h2>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500">No anomalies yet. Alerts appear for whale prints and z-score spikes.</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-accent-yellow" />
                      <span className="font-mono text-sm text-white">{alert.symbol}</span>
                    </div>
                    <span className="text-xs text-gray-400">{alert.timestamp.toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">{alert.reason}</p>
                  <p className="text-xs mt-1 font-mono text-white">
                    {alert.direction} ${alert.size.toFixed(2)}M
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
