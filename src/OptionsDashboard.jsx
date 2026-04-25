import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Card component for metrics
const OptionMetricCard = ({ title, icon: Icon, data, loading, onRefresh }) => {
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (data && data.length > 0) {
      setSelectedItem(data[0]);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 animate-pulse">
        <div className="h-4 bg-dark-700 rounded w-1/2 mb-4"></div>
        <div className="h-20 bg-dark-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />}
          <h3 className="font-semibold text-white text-sm">{title}</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-white"
          >
            <Clock size={14} />
          </button>
        )}
      </div>

      {/* List of items */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {(data || []).slice(0, 8).map((item, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedItem(item)}
            className={`w-full text-left p-2 rounded-lg transition-all ${
              selectedItem === item
                ? 'bg-dark-700 border border-accent-cyan'
                : 'hover:bg-dark-700/50'
            }`}
            style={{
              borderColor: selectedItem === item ? 'var(--color-accent)' : undefined
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{item.symbol}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  item.type === 'CALL'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {item.type}
                </span>
              </div>
              <span className="font-mono text-xs text-gray-400">
                {item.volume?.toLocaleString() || item.open_interest?.toLocaleString()}
              </span>
            </div>
            {item.volume_change_pct && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${
                item.volume_change_pct > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {item.volume_change_pct > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(item.volume_change_pct).toFixed(1)}%
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected detail */}
      {selectedItem && (
        <div className="mt-3 pt-3 border-t border-dark-600">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Strike</span>
              <span className="ml-2 font-mono text-white">
                ${selectedItem.strike?.toFixed(2)}
              </span>
            </div>
            {selectedItem.otm_pct && (
              <div>
                <span className="text-gray-500">OTM</span>
                <span className="ml-2 font-mono text-yellow-400">
                  {selectedItem.otm_pct}%
                </span>
              </div>
            )}
            {selectedItem.iv && (
              <div>
                <span className="text-gray-500">IV</span>
                <span className="ml-2 font-mono text-white">
                  {selectedItem.iv}%
                </span>
              </div>
            )}
            {selectedItem.expiration_months && (
              <div>
                <span className="text-gray-500">Exp</span>
                <span className="ml-2 font-mono text-white">
                  {selectedItem.expiration_months}mo
                </span>
              </div>
            )}
            {selectedItem.days_to_exp && (
              <div>
                <span className="text-gray-500">DTE</span>
                <span className="ml-2 font-mono text-white">
                  {selectedItem.days_to_exp}
                </span>
              </div>
            )}
            {selectedItem.bid && (
              <>
                <div>
                  <span className="text-gray-500">Bid</span>
                  <span className="ml-2 font-mono text-green-400">
                    ${selectedItem.bid.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Ask</span>
                  <span className="ml-2 font-mono text-red-400">
                    ${selectedItem.ask.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Market Cap Milestone Card
const MarketCapCard = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 animate-pulse">
        <div className="h-4 bg-dark-700 rounded w-1/3 mb-4"></div>
        <div className="h-24 bg-dark-700 rounded"></div>
      </div>
    );
  }

  const formatMarketCap = (val) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
    return `$${(val / 1e6).toFixed(0)}M`;
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <div className="flex items-center gap-2 mb-3">
        <Target size={16} className="text-accent-yellow" style={{ color: 'var(--color-accent-yellow)' }} />
        <h3 className="font-semibold text-white text-sm">Market Cap Milestones</h3>
      </div>

      <div className="space-y-2">
        {(data || []).map((item, idx) => (
          <div key={idx} className="p-3 rounded-lg bg-dark-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">{item.symbol}</span>
              <span className="font-mono text-accent-cyan text-sm" style={{ color: 'var(--color-accent)' }}>
                {formatMarketCap(item.market_cap)}
              </span>
            </div>

            {/* Milestone bars */}
            <div className="flex gap-1 mb-2">
              {item.milestones?.map((m, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    m.achieved
                      ? 'bg-green-500'
                      : 'bg-dark-600'
                  }`}
                  title={m.level}
                />
              ))}
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>100B</span>
              <span>500B</span>
              <span>1T</span>
              <span>2T</span>
              <span>3T</span>
            </div>

            {/* Days to target */}
            {item.days_to_target && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-dark-600">
                <span className="text-gray-500">Days to {formatMarketCap(item.target_milestone)}</span>
                <span className="font-mono text-white">{item.days_to_target}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function OptionsDashboard({ settings }) {
  const [metrics, setMetrics] = useState({
    callVol: [],
    putVol: [],
    cheapies: [],
    leaps: [],
    otmStrikes: [],
    otmOi: [],
    marketCap: [],
  });
  const [loading, setLoading] = useState(true);

  // Fetch all metrics
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const baseUrl = ''; // Uses same-origin API

      const [
        callVol,
        putVol,
        cheapies,
        leaps,
        otmStrikes,
        otmOi,
        marketCap,
      ] = await Promise.all([
        fetch(`/options/highest-call-vol?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/options/highest-put-vol?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/options/high-vol-cheapies?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/options/high-vol-leaps?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/options/most-otm-strikes?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/options/large-otm-oi?limit=10`).then(r => r.json()).catch(() => ({ results: [] })),
        fetch(`/marketcap/milestones`).then(r => r.json()).catch(() => ({ results: [] })),
      ]);

      setMetrics({
        callVol: callVol.results || [],
        putVol: putVol.results || [],
        cheapies: cheapies.results || [],
        leaps: leaps.results || [],
        otmStrikes: otmStrikes.results || [],
        otmOi: otmOi.results || [],
        marketCap: marketCap.results || [],
      });
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      {/* Market Cap Milestone Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MarketCapCard data={metrics.marketCap} loading={loading} />
      </div>

      {/* Options Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <OptionMetricCard
          title="Highest Call Volume"
          icon={TrendingUp}
          data={metrics.callVol}
          loading={loading}
          onRefresh={fetchMetrics}
        />
        <OptionMetricCard
          title="Highest Put Volume"
          icon={TrendingDown}
          data={metrics.putVol}
          loading={loading}
        />
        <OptionMetricCard
          title="High Vol Cheapies"
          icon={DollarSign}
          data={metrics.cheapies}
          loading={loading}
        />
        <OptionMetricCard
          title="High Vol LEAPs"
          icon={Clock}
          data={metrics.leaps}
          loading={loading}
        />
        <OptionMetricCard
          title="Most OTM Strikes"
          icon={BarChart3}
          data={metrics.otmStrikes}
          loading={loading}
        />
        <OptionMetricCard
          title="Large OTM OI"
          icon={Target}
          data={metrics.otmOi}
          loading={loading}
        />
      </div>
    </div>
  );
}