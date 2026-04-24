import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, Pause, Play, Filter,
  DollarSign, Clock, BarChart3, PieChart, Zap, RefreshCw
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

// Stock Card Component
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
      onClick={onClick}
      className={`
      relative overflow-hidden rounded-xl p-4 transition-all duration-300 cursor-pointer
      ${isActive ? 'bg-dark-700 ring-2 ring-accent-cyan' : 'bg-dark-800 hover:bg-dark-700'}
    `}
    >
      {/* Intensity Ring */}
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
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
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
          
          {/* Mini Sparkline */}
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

// Transaction Feed Item Component
const TransactionItem = ({ transaction, isNew }) => {
  const isBuy = transaction.direction === 'BUY';
  
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg bg-dark-800 border border-dark-600
      transition-all duration-300
      ${isNew ? 'animate-pulse bg-dark-700 border-accent-cyan' : ''}
    `}>
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm
          ${isBuy ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}
        `}>
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

// Main App Component
export default function App() {
  const [isRunning, setIsRunning] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [selectedStock, setSelectedStock] = useState('ALL');
  const [timeframe, setTimeframe] = useState('1H');
  const [threshold, setThreshold] = useState(1);
  const [chartData, setChartData] = useState({});
  const [stockPrices, setStockPrices] = useState(MAG7_STOCKS);
  const [newTransactionId, setNewTransactionId] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const feedRef = useRef(null);
  const TIMEFRAME_HOURS = { '1H': 1, '4H': 4, '1D': 24 };

  // Initialize chart data for all stocks
  useEffect(() => {
    const initialData = {};
    Object.keys(MAG7_STOCKS).forEach(symbol => {
      initialData[symbol] = generateHistoricalData(symbol, TIMEFRAME_HOURS[timeframe]);
    });
    setChartData(initialData);
  }, [timeframe]);

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Generate new transactions
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const stock = getWeightedRandomStock();
      const transaction = generateTransaction(stock);
      
      setNewTransactionId(transaction.id);
      setTimeout(() => setNewTransactionId(null), 1000);
      
      setTransactions(prev => {
        const updated = [transaction, ...prev].slice(0, 100);
        return updated;
      });

      // Update stock price based on transaction
      setStockPrices(prev => ({
        ...prev,
        [stock.symbol]: {
          ...prev[stock.symbol],
          basePrice: Math.max(
            0.01,
            prev[stock.symbol].basePrice + (transaction.direction === 'BUY' ? 0.05 : -0.05)
          )
        }
      }));

      // Push live transaction volume into selected stock's chart series
      setChartData(prev => {
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
    }, 1500 + Math.random() * 1500);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const stockMatch = selectedStock === 'ALL' || t.symbol === selectedStock;
    const thresholdMatch = t.size >= threshold;
    return stockMatch && thresholdMatch;
  });

  // Calculate stats
  const totalVolume = transactions.reduce((acc, t) => acc + t.size, 0);
  const buyVolume = transactions.filter(t => t.direction === 'BUY').reduce((acc, t) => acc + t.size, 0);
  const sellVolume = transactions.filter(t => t.direction === 'SELL').reduce((acc, t) => acc + t.size, 0);
  const buyRatio = totalVolume > 0 ? (buyVolume / totalVolume * 100).toFixed(1) : 50;

  // Prepare chart data for main bar chart
  const mainChartData = selectedStock === 'ALL'
    ? Object.keys(MAG7_STOCKS).map(symbol => {
        const stockTxns = transactions.filter(t => t.symbol === symbol);
        const buyVol = stockTxns.filter(t => t.direction === 'BUY').reduce((acc, t) => acc + t.size, 0);
        const sellVol = stockTxns.filter(t => t.direction === 'SELL').reduce((acc, t) => acc + t.size, 0);
        return {
          name: symbol,
          buy: buyVol,
          sell: sellVol,
          total: buyVol + sellVol,
        };
      })
    : chartData[selectedStock]?.map(d => ({
        name: d.label,
        buy: d.buyVolume,
        sell: d.sellVolume,
        total: d.totalVolume,
      })) || [];

  return (
    <div className="min-h-screen bg-dark-900 p-4 lg:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-purple flex items-center justify-center">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">DARKPOOL MONITOR</h1>
            <p className="text-xs text-gray-500">Real-time Institutional Activity</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={16} />
            <span className="font-mono text-sm">
              {currentTime.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-xs text-gray-400">LIVE</span>
          </div>
          
          <div className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-1.5">
            <DollarSign size={14} className="text-accent-cyan" />
            <span className="font-mono text-sm text-white">
              {formatMillionsCurrency(totalVolume)}
            </span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
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
            onClick={() => {
              setTimeframe('1H');
              setChartData(Object.fromEntries(
                Object.keys(MAG7_STOCKS).map(symbol => [
                  symbol,
                  generateHistoricalData(symbol, TIMEFRAME_HOURS['1H'])
                ])
              ));
            }}
            className="p-2 rounded-lg bg-dark-800 text-gray-400 hover:text-white transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {['1H', '4H', '1D'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`
                px-3 py-1.5 rounded-lg font-mono text-sm transition-all
                ${timeframe === tf 
                  ? 'bg-accent-cyan/20 text-accent-cyan' 
                  : 'bg-dark-800 text-gray-400 hover:text-white'}
              `}
            >
              {tf}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <select
            value={selectedStock}
            onChange={(e) => setSelectedStock(e.target.value)}
            className="bg-dark-800 text-white rounded-lg px-3 py-1.5 font-mono text-sm border border-dark-600 focus:border-accent-cyan outline-none"
          >
            <option value="ALL">ALL STOCKS</option>
            {Object.values(MAG7_STOCKS).map(stock => (
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
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-24 accent-accent-cyan"
          />
          <span className="font-mono text-sm text-accent-cyan">${threshold}M</span>
        </div>
      </div>

      {/* Stock Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        {Object.values(MAG7_STOCKS).map(stock => (
          <StockCard
            key={stock.symbol}
            stock={stockPrices[stock.symbol] || stock}
            data={chartData[stock.symbol] || []}
            isActive={selectedStock === stock.symbol}
            onClick={() => setSelectedStock(stock.symbol)}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart */}
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
                  tickFormatter={(v) => `${v}M`}
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

        {/* Stats Panel */}
        <div className="bg-dark-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-accent-purple" />
            Summary
          </h2>
          
          <div className="space-y-4">
            {/* Buy/Sell Ratio */}
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
            
            {/* Volume Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">TOTAL VOLUME</p>
                <p className="font-mono text-xl font-bold text-white">
                  {formatVolume(totalVolume)}M
                </p>
              </div>
              <div className="bg-dark-700 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">TRANSACTIONS</p>
                <p className="font-mono text-xl font-bold text-white">
                  {transactions.length}
                </p>
              </div>
              <div className="bg-accent-green/10 rounded-lg p-3">
                <p className="text-xs text-accent-green mb-1">BUY VOLUME</p>
                <p className="font-mono text-lg font-bold text-accent-green">
                  {formatVolume(buyVolume)}M
                </p>
              </div>
              <div className="bg-accent-red/10 rounded-lg p-3">
                <p className="text-xs text-accent-red mb-1">SELL VOLUME</p>
                <p className="font-mono text-lg font-bold text-accent-red">
                  {formatVolume(sellVolume)}M
                </p>
              </div>
            </div>
            
            {/* Most Active */}
            <div className="bg-dark-700 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-3">MOST ACTIVE</p>
              {Object.entries(
                transactions.reduce((acc, t) => {
                  acc[t.symbol] = (acc[t.symbol] || 0) + t.size;
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([symbol, vol]) => (
                  <div key={symbol} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                    <span className="font-mono font-semibold text-white">{symbol}</span>
                    <span className="font-mono text-sm text-accent-cyan">{formatVolume(vol)}M</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Feed */}
      <div className="mt-6 bg-dark-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap size={20} className="text-accent-yellow" />
            Live Transaction Feed
          </h2>
          <span className="text-xs text-gray-500">
            Showing {filteredTransactions.length} transactions
          </span>
        </div>
        
        <div 
          ref={feedRef}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto"
        >
          {filteredTransactions.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              No transactions matching current filters
            </div>
          ) : (
            filteredTransactions.slice(0, 24).map(txn => (
              <TransactionItem 
                key={txn.id} 
                transaction={txn}
                isNew={newTransactionId === txn.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}