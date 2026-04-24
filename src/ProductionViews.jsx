import { useState, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Activity, Clock, AlertTriangle, CheckCircle, PauseCircle, MessageSquare, Zap } from 'lucide-react';

// Scanner Table Component
const ScannerView = () => {
  const [prints, setPrints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('size');
  const [minSize, setMinSize] = useState(1000);

  const fetchPrints = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/scanner/prints?min_size=${minSize}&sort_by=${sortBy}&limit=50`);
      const data = await res.json();
      setPrints(data.scanner || []);
    } catch (err) {
      console.error('Failed to fetch prints:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPrints();
    const interval = setInterval(fetchPrints, 5000);
    return () => clearInterval(interval);
  }, [minSize, sortBy]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm text-gray-400">Min Size:</span>
          <input
            type="number"
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value))}
            className="w-24 bg-dark-700 text-white rounded px-2 py-1 text-sm font-mono"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={16} className="text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark-700 text-white rounded px-2 py-1 text-sm"
          >
            <option value="size">Size</option>
            <option value="z_score">Z-Score</option>
            <option value="adv_pct">ADV%</option>
            <option value="price">Price</option>
          </select>
        </div>
        <button
          onClick={fetchPrints}
          className="ml-auto px-3 py-1 bg-dark-700 rounded text-sm hover:bg-dark-600"
        >
          Refresh
        </button>
      </div>

      {/* Scanner Table */}
      <div className="bg-dark-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-dark-700 text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">Symbol</th>
              <th className="px-4 py-2 text-left">Side</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2 text-left">Venue</th>
              <th className="px-4 py-2 text-left">Feed</th>
              <th className="px-4 py-2 text-right">Conf.</th>
              <th className="px-4 py-2 text-right">Z-Score</th>
              <th className="px-4 py-2 text-right">ADV%</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : prints.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No prints</td></tr>
            ) : prints.map((print, idx) => (
              <tr key={idx} className="border-t border-dark-700 hover:bg-dark-700/50">
                <td className="px-4 py-2 font-mono text-white">{print.symbol}</td>
                <td className="px-4 py-2">
                  <span className={print.side === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                    {print.side}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-white">{print.size.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono text-white">${print.price}</td>
                <td className="px-4 py-2 text-gray-400">{print.venue}</td>
                <td className="px-4 py-2 text-gray-400">{print.feed_type}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`px-1 rounded ${print.confidence >= 0.9 ? 'text-green-400' : print.confidence >= 0.8 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {print.confidence?.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className={print.z_score > 2 ? 'text-red-400' : print.z_score < -2 ? 'text-blue-400' : 'text-gray-400'}>
                    {print.z_score?.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-gray-400">{print.adv_pct?.toFixed(4)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Alert Log Component
const AlertsView = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/alerts/trigger-log?limit=50');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
    setLoading(false);
  };

  const handleAck = async (alertId) => {
    try {
      await fetch(`/alerts/${alertId}/ack`, { method: 'POST' });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to ack alert:', err);
    }
  };

  const handleSnooze = async (alertId) => {
    try {
      await fetch(`/alerts/${alertId}/snooze?duration=15`, { method: 'POST' });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to snooze alert:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const stateIcons = {
    new: <AlertTriangle size={14} className="text-yellow-400" />,
    acknowledged: <CheckCircle size={14} className="text-green-400" />,
    snoozed: <PauseCircle size={14} className="text-gray-400" />,
    resolved: <CheckCircle size={14} className="text-green-600" />,
  };

  const severityColors = {
    low: 'bg-gray-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-4">
        <Activity size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
        <span className="text-white font-medium">Alert Trigger Log</span>
        <span className="ml-auto text-sm text-gray-400">{alerts.length} alerts</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="bg-dark-800 rounded-xl p-8 text-center text-gray-500">Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-dark-800 rounded-xl p-8 text-center text-gray-500">No alerts</div>
        ) : alerts.map((alert) => (
          <div key={alert.id} className="bg-dark-800 rounded-xl p-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${severityColors[alert.severity]}`} />
              {stateIcons[alert.state]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">{alert.symbol}</span>
                <span className="text-gray-400 text-sm">{alert.alert_type}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-500">{alert.channel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Clock size={12} />
                <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                {alert.dedup_reason && (
                  <>
                    <span>•</span>
                    <span className="text-yellow-400">{alert.dedup_reason}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${
                alert.routing_status === 'sent' ? 'bg-green-500/20 text-green-400' :
                alert.routing_status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {alert.routing_status}
              </span>
              {alert.state === 'new' && (
                <>
                  <button
                    onClick={() => handleAck(alert.id)}
                    className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30"
                  >
                    Ack
                  </button>
                  <button
                    onClick={() => handleSnooze(alert.id)}
                    className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30"
                  >
                    Snooze
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Watchlist Component
const WatchlistView = () => {
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWatchlists = async () => {
      setLoading(true);
      try {
        const res = await fetch('/watchlists');
        const data = await res.json();
        setWatchlists(data.watchlists || []);
      } catch (err) {
        console.error('Failed to fetch watchlists:', err);
      }
      setLoading(false);
    };
    fetchWatchlists();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-4">
        <Zap size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
        <span className="text-white font-medium">Watchlists</span>
        <button className="ml-auto px-3 py-1 bg-dark-700 rounded text-sm hover:bg-dark-600">
          + New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="md:col-span-3 bg-dark-800 rounded-xl p-8 text-center text-gray-500">
            Loading...
          </div>
        ) : watchlists.map((wl) => (
          <div key={wl.id} className="bg-dark-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-white">{wl.name}</h3>
              <span className="text-xs text-gray-500">{wl.owner}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {wl.symbols.map((sym) => (
                <span key={sym} className="px-2 py-1 bg-dark-700 rounded text-sm font-mono text-white">
                  {sym}
                </span>
              ))}
            </div>
            <div className="text-xs text-gray-500">
              <Clock size={12} className="inline mr-1" />
              Created {new Date(wl.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// System Health Component
const HealthView = () => {
  const [health, setHealth] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const [healthRes, sourcesRes] = await Promise.all([
          fetch('/health/system'),
          fetch('/data/sources'),
        ]);
        const healthData = await healthRes.json();
        const sourcesData = await sourcesRes.json();
        setHealth(healthData);
        setSources(sourcesData.sources || []);
      } catch (err) {
        console.error('Failed to fetch health:', err);
      }
      setLoading(false);
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="bg-dark-800 rounded-xl p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Health Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Feed Lag</div>
          <div className="text-2xl font-mono text-white">{health?.feed_lag_ms}ms</div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Dropped Events</div>
          <div className={`text-2xl font-mono ${health?.dropped_events > 10 ? 'text-red-400' : 'text-white'}`}>
            {health?.dropped_events}
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Parser Errors</div>
          <div className={`text-2xl font-mono ${health?.parser_errors > 5 ? 'text-red-400' : 'text-white'}`}>
            {health?.parser_errors}
          </div>
        </div>
        <div className="bg-dark-800 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">CPU</div>
          <div className="text-2xl font-mono text-white">{health?.cpu_usage_pct}%</div>
        </div>
      </div>

      {/* Connectors */}
      <div className="bg-dark-800 rounded-xl p-4">
        <h3 className="font-medium text-white mb-4">Data Connectors</h3>
        <div className="space-y-2">
          {sources.map((src) => (
            <div key={src.id} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  src.status === 'connected' ? 'bg-green-400' :
                  src.status === 'error' ? 'bg-red-400' :
                  'bg-gray-400'
                }`} />
                <div>
                  <div className="text-white font-medium">{src.name}</div>
                  <div className="text-xs text-gray-500">{src.provider}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-white">{src.events_received?.toLocaleString()}</div>
                <div className="text-xs text-gray-500">events</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono text-white">{src.feed_lag_ms}ms</div>
                <div className="text-xs text-gray-500">lag</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default { ScannerView, AlertsView, WatchlistView, HealthView };