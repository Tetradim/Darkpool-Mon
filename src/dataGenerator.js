// MAG7 Stock Data with realistic base prices
export const MAG7_STOCKS = {
  NVDA: { symbol: 'NVDA', name: 'NVIDIA', basePrice: 875.50, weight: 0.18 },
  AAPL: { symbol: 'AAPL', name: 'Apple', basePrice: 178.25, weight: 0.16 },
  MSFT: { symbol: 'MSFT', name: 'Microsoft', basePrice: 415.80, weight: 0.15 },
  GOOGL: { symbol: 'GOOGL', name: 'Alphabet', basePrice: 175.60, weight: 0.14 },
  AMZN: { symbol: 'AMZN', name: 'Amazon', basePrice: 185.40, weight: 0.14 },
  META: { symbol: 'META', name: 'Meta', basePrice: 525.75, weight: 0.12 },
  TSLA: { symbol: 'TSLA', name: 'Tesla', basePrice: 175.20, weight: 0.11 },
};

// Generate a random transaction size between $1M and $50M
export const generateTransactionSize = () => {
  const min = 1;
  const max = 50;
  // Use exponential distribution for more realistic large transactions
  const u = Math.random();
  const size = min + (max - min) * Math.pow(u, 2);
  return Math.round(size * 100) / 100;
};

// Generate a random price variation
export const generatePriceVariation = (basePrice) => {
  const variation = (Math.random() - 0.5) * 0.01 * basePrice; // ±0.5%
  return Math.round((basePrice + variation) * 100) / 100;
};

// Generate a random transaction direction (buy/sell)
export const generateDirection = () => {
  return Math.random() > 0.5 ? 'BUY' : 'SELL';
};

// Generate a unique transaction ID
export const generateTransactionId = () => {
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// Generate a complete transaction
export const generateTransaction = (stockData = null) => {
  const stockKeys = Object.keys(MAG7_STOCKS);
  const stock = stockData || MAG7_STOCKS[stockKeys[Math.floor(Math.random() * stockKeys.length)]];
  
  const size = generateTransactionSize();
  const direction = generateDirection();
  const price = generatePriceVariation(stock.basePrice);
  
  return {
    id: generateTransactionId(),
    symbol: stock.symbol,
    name: stock.name,
    size: size,
    price: price,
    value: Math.round(size * price * 100) / 100,
    direction: direction,
    timestamp: new Date(),
  };
};

// Generate historical data for charts
export const generateHistoricalData = (symbol, hours = 24) => {
  const stock = MAG7_STOCKS[symbol];
  if (!stock) return [];

  const data = [];
  const now = Date.now();
  const interval = (hours * 60 * 60 * 1000) / 48; // 48 data points

  for (let i = 48; i >= 0; i--) {
    const timestamp = now - (i * interval);
    const buyVolume = Math.round(Math.random() * 20 + 5);
    const sellVolume = Math.round(Math.random() * 20 + 5);
    
    data.push({
      time: timestamp,
      label: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      buyVolume,
      sellVolume,
      totalVolume: buyVolume + sellVolume,
      price: generatePriceVariation(stock.basePrice),
    });
  }

  return data;
};

// Get weighted random stock (based on trading activity weight)
export const getWeightedRandomStock = () => {
  const stocks = Object.values(MAG7_STOCKS);
  const weights = stocks.map(s => s.weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < stocks.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return stocks[i];
    }
  }
  
  return stocks[stocks.length - 1];
};

// Format currency
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format values represented in millions of dollars as USD currency
export const formatMillionsCurrency = (valueInMillions) => {
  return formatCurrency(valueInMillions * 1000000);
};

// Format large numbers
export const formatVolume = (value) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};
