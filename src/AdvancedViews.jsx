import { useState, useEffect, useMemo } from 'react';
import { Flame, Clock, Pause, Play, FastForward, ChevronLeft, ChevronRight, BarChart2, Layers, Grid, Zap } from 'lucide-react';

// Flow Map Heatmap Component
const FlowMapView = () => {
  const [heatmap, setHeatmap] = useState([]);
  const [buckets, setBuckets] = useState(13);
  const [loading, setLoading] = useState(true);

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

  // Group by symbol for grid
  const symbols = useMemo(() => {
    const syms = [...new Set(heatmap.map(h => h.symbol))];
    return syms;
  }, [heatmap]);

  const getColor = (score) => {
    if (score > 70) return 'bg-red-500';
    if (score > 50) return 'bg-orange-500';
    if (score > 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 bg-dark-800 rounded-xl p-4">
        <Flame size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
        <span className="text-white font-medium">Flow Map</span>
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
              {symbols.map(sym => (
                <tr key={sym}>
                  <td className="px-2 py-1 font-mono text-white text-sm">{sym}</td>
                  {Array.from({ length: buckets }, (_, bucket) => {
                    const cell = heatmap.find(h => h.symbol === sym && h.bucket === bucket);
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

  // Playback controls
  useEffect(() => {
    if (!isPlaying || events.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % events.length);
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, speed, events.length]);

  const handleSeek = (index) => {
    setCurrentIndex(index);
    setIsPlaying(false);
  };

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
            max={events.length - 1}
            value={currentIndex}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        <div className="text-sm font-mono text-gray-400">
          {currentIndex + 1} / {events.length}
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
            ) : events.length === 0 ? (
              <tr><td colSpan={5} className="px-2 py-4 text-center text-gray-500">No events</td></tr>
            ) : events.slice(0, 100).map((evt, idx) => (
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

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-dark-800 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
            {(apiKeys || []).map(key => (
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
            {(auditLogs || []).map(log => (
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
            {(retentionPolicies || []).map(policy => (
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