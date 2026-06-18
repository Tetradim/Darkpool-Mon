import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const StockSparkline = ({ stock, data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data.slice(-20)}>
      <defs>
        <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={stock.change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.4} />
          <stop offset="95%" stopColor={stock.change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area
        type="monotone"
        dataKey="totalVolume"
        stroke={stock.change >= 0 ? '#22c55e' : '#ef4444'}
        fill={`url(#grad-${stock.symbol})`}
        strokeWidth={1.5}
      />
    </AreaChart>
  </ResponsiveContainer>
);

export const TransactionVolumeChart = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data.length > 0 ? data : [{ name: 'No Data', buy: 0, sell: 0 }]}>
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
);
