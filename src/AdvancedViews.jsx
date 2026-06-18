import { useState, useEffect, useMemo } from 'react';
import { Flame, Clock, Pause, Play, FastForward, Search, BarChart2, Layers, Grid, Zap } from 'lucide-react';
import {
  filterAdminApiKeys,
  filterAdminAuditLogs,
  filterRetentionPolicies,
  summarizeAdminState,
} from './adminFilters';
import { filterHeatmapCells, summarizeHeatmapCells } from './flowMapFilters';
import { REPLAY_SIDE_FILTERS, filterReplayEvents, summarizeReplayEvents } from './replayFilters';

// Flow Map Heatmap Component
const FlowMapView = () => {
  const [heatmap, setHeatmap] = useState([]);
  const [buckets, setBuckets] = useState(13);
  const [loading, setLoading] = useState(true);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [minScore, setMinScore] = useState(0);

  const fetchHeatmap = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/chart/heatmap?buckets=${buckets}`);
      const data = await res.json();
      setHeatmap(data.heatmap || []);
    } catch (err) {
      console.error('Failed to fetch heatmap:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 10000);
    return () => clearInterval(interval);
  }, [buckets]);

  const visibleHeatmap = useMemo(
    () => filterHeatmapCells(heatmap, { query: symbolQuery, minScore }),
    [heatmap, symbolQuery, minScore]
  );
  const heatmapSummary = useMemo(() => summarizeHeatmapCells(visibleHeatmap), [visibleHeatmap]);
  const hasActiveHeatmapFilters = Boolean(symbolQuery.trim() || minScore > 0);
  const heatmapSummaryCards = [
    {
      label: 'Symbols',
      value: heatmapSummary.activeSymbols,
      detail: `${visibleHeatmap.length}/${heatmap.length} cells`,
    },
    {
      label: 'Hotspots',
      value: heatmapSummary.hotspotCount,
      detail: 'Score >= 70',
      onClick: () => setMinScore(70),
    },
    {
      label: 'Volume',
      value: `${(heatmapSummary.totalVolume / 1000000).toFixed(1)}M`,
      detail: 'Filtered flow',
    },
    {
      label: 'Top Flow',
      value: heatmapSummary.topSymbol.symbol,
      detail: `score ${heatmapSummary.topSymbol.score}`,
      onClick: heatmapSummary.topSymbol.symbol !== 'N/A'
        ? () => setSymbolQuery(heatmapSummary.topSymbol.symbol)
        : undefined,
    },
  ];

  const clearHeatmapFilters = () => {
    setSymbolQuery('');
    setMinScore(0);
  };

  // Group by symbol for grid
  const symbols = useMemo(() => {
    const syms = [...new Set(visibleHeatmap.map(h => h.symbol))];
    return syms;
  }, [visibleHeatmap]);

  const getColor = (score) => {
    if (score > 70) return 'bg-red-500';
    if (score > 50) return 'bg-orange-500';
    if (score > 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 bg-dark-800 rounded-xl p-4">
        <Flame size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
        <span className="text-white font-medium">Flow Map</span>
        <span className="text-xs text-gray-500">{visibleHeatmap.length}/{heatmap.length} cells</span>
        <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-dark-600 bg-dark-900/70 px-3 py-1.5 focus-within:border-accent-cyan">
          <Search size={14} className="text-gray-500" />
          <input
            value={symbolQuery}
            onChange={(event) => setSymbolQuery(event.target.value)}
            placeholder="Search symbol"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-gray-600"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Score</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(event) => setMinScore(Number(event.target.value))}
            className="w-24 accent-accent-cyan"
          />
          <span className="w-8 text-right font-mono text-xs text-accent-cyan">{minScore}</span>
        </label>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-400">Buckets:</span>
          <input
            type="number"
            value={buckets}
            onChange={(e) => setBuckets(Number(e.target.value))}
            className="w-16 bg-dark-700 text-white rounded px-2 py-1 text-sm"
            min={5}
            max={26}
          />
        </div>
        <button onClick={fetchHeatmap} className="px-3 py-1 bg-dark-700 rounded text-sm hover:bg-dark-600">
          Refresh
        </button>
        {hasActiveHeatmapFilters && (
          <button
            type="button"
            onClick={clearHeatmapFilters}
            className="rounded-lg bg-dark-900/70 px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-700 hover:text-white"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {heatmapSummaryCards.map(({ label, value, detail, onClick }) => (
          <button
            key={label}
            type="button"
            disabled={!onClick}
            onClick={onClick}
            className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-left text-orange-200 transition-all enabled:hover:border-orange-300/40 enabled:hover:bg-orange-500/15 disabled:cursor-default"
          >
            <div className="text-xs font-semibold uppercase text-current/70">{label}</div>
            <div className="mt-2 truncate font-mono text-2xl font-bold text-white">{value}</div>
            <div className="mt-1 truncate text-xs text-current/70">{detail}</div>
          </button>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="bg-dark-800 rounded-xl p-4 overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-gray-400 text-xs">Ticker</th>
                {Array.from({ length: buckets }, (_, i) => (
                  <th key={i} className="px-1 py-1 text-center text-gray-400 text-xs">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.length === 0 ? (
                <tr>
                  <td colSpan={buckets + 1} className="px-2 py-6 text-center text-gray-500">
                    No heatmap cells match the current filters
                  </td>
                </tr>
              ) : symbols.map(sym => (
                <tr key={sym}>
                  <td className="px-2 py-1 font-mono text-white text-sm">{sym}</td>
                  {Array.from({ length: buckets }, (_, bucket) => {
                    const cell = visibleHeatmap.find(h => h.symbol === sym && h.bucket === bucket);
                    return (
                      <td key={bucket} className="px-0.5 py-0.5">
                        <div
                          className={`w-6 h-6 rounded ${getColor(cell?.score || 0)}`}
                          title={`Score: ${cell?.score}, Vol: ${cell?.volume?.toLocaleString()}`}
                          style={{ opacity: (cell?.score || 0) / 100 + 0.3 }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-3">
        <span className="text-xs text-gray-400">Legend:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-xs text-gray-400">0-30</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500" />
          <span className="text-xs text-gray-400">30-50</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-500" />
          <span className="text-xs text-gray-400">50-70</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" />
          <span className="text-xs text-gray-400">70-100</span>
        </div>
      </div>
    </div>
  );
};

// Replay Component
const ReplayView = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('16:00');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [sideFilter, setSideFilter] = useState('ALL');
  const [minSize, setMinSize] = useState(0);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/replay/events?start_time=${startTime}&end_time=${endTime}&speed=${speed}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, [startTime, endTime]);

  const visibleEvents = useMemo(
    () => filterReplayEvents(events, { query: symbolQuery, side: sideFilter, minSize }),
    [events, symbolQuery, sideFilter, minSize]
  );
  const replaySummary = useMemo(() => summarizeReplayEvents(visibleEvents), [visibleEvents]);
  const hasActiveReplayFilters = Boolean(symbolQuery.trim() || sideFilter !== 'ALL' || minSize > 0);
  const replaySummaryCards = [
    {
      label: 'Events',
      value: replaySummary.totalEvents,
      detail: `${visibleEvents.length}/${events.length} visible`,
    },
    {
      label: 'Notional',
      value: `$${(replaySummary.totalNotional / 1000000).toFixed(1)}M`,
      detail: 'Filtered tape value',
    },
    {
      label: 'Buy Events',
      value: replaySummary.buyCount,
      detail: 'Filter buys',
      onClick: () => setSideFilter('BUY'),
    },
    {
      label: 'Sell Events',
      value: replaySummary.sellCount,
      detail: 'Filter sells',
      onClick: () => setSideFilter('SELL'),
    },
    {
      label: 'Top Symbol',
      value: replaySummary.topSymbol.symbol,
      detail: `${replaySummary.topSymbol.count} event${replaySummary.topSymbol.count === 1 ? '' : 's'}`,
      onClick: replaySummary.topSymbol.symbol !== 'N/A'
        ? () => setSymbolQuery(replaySummary.topSymbol.symbol)
        : undefined,
    },
  ];

  const clearReplayFilters = () => {
    setSymbolQuery('');
    setSideFilter('ALL');
    setMinSize(0);
  };

  // Playback controls
  useEffect(() => {
    if (!isPlaying || visibleEvents.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % visibleEvents.length);
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, visibleEvents.length]);

  const handleSeek = (index) => {
    setCurrentIndex(index);
    setIsPlaying(false);
  };

  useEffect(() => {
    setCurrentIndex((index) => Math.min(index, Math.max(visibleEvents.length - 1, 0)));
  }, [visibleEvents.length]);

  return (
    <div className="space-y-4">
      {/* Time Controls */}
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-4">
        <Clock size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
        <span className="text-white font-medium">Replay</span>
        
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-400">Start:</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-dark-700 text-white rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">End:</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="bg-dark-700 text-white rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {replaySummaryCards.map(({ label, value, detail, onClick }) => (
          <button
            key={label}
            type="button"
            disabled={!onClick}
            onClick={onClick}
            className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-left text-purple-200 transition-all enabled:hover:border-purple-300/40 enabled:hover:bg-purple-500/15 disabled:cursor-default"
          >
            <div className="text-xs font-semibold uppercase text-current/70">{label}</div>
            <div className="mt-2 truncate font-mono text-2xl font-bold text-white">{value}</div>
            <div className="mt-1 truncate text-xs text-current/70">{detail}</div>
          </button>
        ))}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2 bg-dark-800 rounded-xl p-3">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-2 rounded-lg ${isPlaying ? 'bg-red-500' : 'bg-green-500'}`}
        >
          {isPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" />}
        </button>
        
        <button onClick={() => handleSeek(0)} className="p-2 rounded-lg bg-dark-700">
          <FastForward size={16} className="text-white rotate-180" />
        </button>
        
        <div className="flex-1 mx-4">
          <input
            type="range"
            min={0}
            max={Math.max(visibleEvents.length - 1, 0)}
            value={currentIndex}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="text-sm font-mono text-gray-400">
          {visibleEvents.length === 0 ? 0 : currentIndex + 1} / {visibleEvents.length}
        </div>
        
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="bg-dark-700 text-white rounded px-2 py-1 text-sm"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
          <option value={10}>10x</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-dark-800 rounded-xl p-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-dark-600 bg-dark-900/70 px-3 py-1.5 focus-within:border-accent-cyan">
          <Search size={14} className="text-gray-500" />
          <input
            value={symbolQuery}
            onChange={(event) => setSymbolQuery(event.target.value)}
            placeholder="Search symbol"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-gray-600"
          />
        </label>

        <div className="flex items-center gap-1 rounded-lg bg-dark-900/70 p-1">
          {REPLAY_SIDE_FILTERS.map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setSideFilter(side)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                sideFilter === side
                  ? 'bg-dark-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {side}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Min size</span>
          <input
            type="number"
            value={minSize}
            min={0}
            step={1000}
            onChange={(event) => setMinSize(Number(event.target.value))}
            className="w-28 rounded bg-dark-700 px-2 py-1 font-mono text-sm text-white"
          />
        </label>

        {hasActiveReplayFilters && (
          <button
            type="button"
            onClick={clearReplayFilters}
            className="rounded-lg bg-dark-900/70 px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-700 hover:text-white"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Event Stream */}
      <div className="bg-dark-800 rounded-xl p-4 max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-dark-800">
            <tr className="text-gray-400">
              <th className="px-2 py-1 text-left">Time</th>
              <th className="px-2 py-1 text-left">Symbol</th>
              <th className="px-2 py-1 text-left">Side</th>
              <th className="px-2 py-1 text-right">Size</th>
              <th className="px-2 py-1 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : visibleEvents.length === 0 ? (
              <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">No events</td></tr>
            ) : visibleEvents.slice(0, 100).map((evt, idx) => (
              <tr 
                key={idx} 
                className={`border-t border-dark-700 ${idx === currentIndex ? 'bg-accent-cyan/20' : ''}`}
                style={{ backgroundColor: idx === currentIndex ? 'var(--color-accent)' + '33' : undefined }}
              >
                <td className="px-2 py-1 text-gray-400">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                <td className="px-2 py-1 font-mono text-white">{evt.symbol}</td>
                <td className={`px-2 py-1 ${evt.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                  {evt.side}
                </td>
                <td className="px-2 py-1 text-right font-mono text-white">{evt.size.toLocaleString()}</td>
                <td className="px-2 py-1 text-right font-mono text-white">${evt.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Admin View Component
const AdminView = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('api-keys');
  const [adminQuery, setAdminQuery] = useState('');
  const [keyStatus, setKeyStatus] = useState('all');
  const [retentionMode, setRetentionMode] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [keysRes, auditRes, retentionRes] = await Promise.all([
          fetch('/admin/api-keys'),
          fetch('/admin/audit-log'),
          fetch('/admin/retention'),
        ]);
        setApiKeys((await keysRes.json()).keys || []);
        setAuditLogs((await auditRes.json()).logs || []);
        setRetentionPolicies((await retentionRes.json()).policies || []);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const tabs = [
    { id: 'api-keys', label: 'API Keys' },
    { id: 'audit', label: 'Audit Log' },
    { id: 'retention', label: 'Retention' },
  ];
  const adminSummary = summarizeAdminState({ apiKeys, auditLogs, retentionPolicies });
  const visibleApiKeys = filterAdminApiKeys(apiKeys || [], { query: adminQuery, status: keyStatus });
  const visibleAuditLogs = filterAdminAuditLogs(auditLogs || [], { query: adminQuery });
  const visibleRetentionPolicies = filterRetentionPolicies(retentionPolicies || [], {
    query: adminQuery,
    mode: retentionMode,
  });
  const activeCount = activeTab === 'api-keys'
    ? visibleApiKeys.length
    : activeTab === 'audit'
      ? visibleAuditLogs.length
      : visibleRetentionPolicies.length;
  const totalCount = activeTab === 'api-keys'
    ? apiKeys.length
    : activeTab === 'audit'
      ? auditLogs.length
      : retentionPolicies.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['API Keys', adminSummary.keyCount],
          ['Active Keys', adminSummary.activeKeyCount],
          ['Audit Logs', adminSummary.auditLogCount],
          ['Auto Delete', adminSummary.autoDeletePolicyCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-cyan-200">
            <div className="text-xs font-semibold uppercase text-current/70">{label}</div>
            <div className="mt-2 font-mono text-2xl font-bold text-white">{value}</div>
            {label === 'Audit Logs' && adminSummary.latestAuditAt && (
              <div className="mt-1 text-xs text-current/70">
                latest {new Date(adminSummary.latestAuditAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3 bg-dark-800 rounded-xl p-3">
        <div className="flex items-center gap-1 rounded-xl bg-dark-900/70 p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setAdminQuery('');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-dark-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>
        <span className="text-xs text-gray-500">{activeCount}/{totalCount} rows</span>
        <label className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-dark-600 bg-dark-900/70 px-3 py-1.5 focus-within:border-accent-cyan">
          <Search size={14} className="text-gray-500" />
          <input
            value={adminQuery}
            onChange={(event) => setAdminQuery(event.target.value)}
            placeholder="Search current tab"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
          />
        </label>
        {activeTab === 'api-keys' && (
          <select
            value={keyStatus}
            onChange={(event) => setKeyStatus(event.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-900/70 px-3 py-1.5 text-sm text-white outline-none focus:border-accent-cyan"
          >
            <option value="all">All keys</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        )}
        {activeTab === 'retention' && (
          <select
            value={retentionMode}
            onChange={(event) => setRetentionMode(event.target.value)}
            className="rounded-lg border border-dark-600 bg-dark-900/70 px-3 py-1.5 text-sm text-white outline-none focus:border-accent-cyan"
          >
            <option value="all">All policies</option>
            <option value="auto">Auto-delete</option>
            <option value="manual">Manual</option>
          </select>
        )}
      </div>

      {/* API Keys */}
      {activeTab === 'api-keys' && (
        <div className="bg-dark-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">API Keys</h3>
            <button className="px-3 py-1 bg-accent-cyan rounded text-sm text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              + Add Key
            </button>
          </div>
          <div className="space-y-2">
            {visibleApiKeys.length === 0 ? (
              <div className="rounded-lg border border-dashed border-dark-600 bg-dark-900/40 p-4 text-sm text-gray-500">
                No API keys match the current filters.
              </div>
            ) : visibleApiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">{key.provider}</div>
                  <div className="text-sm text-gray-400 font-mono">{key.key_masked}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${key.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {key.status}
                  </span>
                  <button className="text-red-400 text-sm hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-dark-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-4">Audit Log</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleAuditLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-dark-600 bg-dark-900/40 p-4 text-sm text-gray-500">
                No audit logs match the current search.
              </div>
            ) : visibleAuditLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-2 bg-dark-700 rounded text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-white">{log.action}</span>
                  <span className="text-gray-400 text-xs">by {log.user}</span>
                </div>
                <span className="text-gray-500 text-xs font-mono">{log.ip_address}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention */}
      {activeTab === 'retention' && (
        <div className="bg-dark-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Retention Policies</h3>
            <button className="px-3 py-1 bg-accent-cyan rounded text-sm text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              + Add Policy
            </button>
          </div>
          <div className="space-y-2">
            {visibleRetentionPolicies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-dark-600 bg-dark-900/40 p-4 text-sm text-gray-500">
                No retention policies match the current filters.
              </div>
            ) : visibleRetentionPolicies.map(policy => (
              <div key={policy.id} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">{policy.name}</div>
                  <div className="text-sm text-gray-400">{policy.duration_days} days</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${policy.auto_delete ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {policy.auto_delete ? 'Auto-delete' : 'Manual'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { FlowMapView, ReplayView, AdminView };
