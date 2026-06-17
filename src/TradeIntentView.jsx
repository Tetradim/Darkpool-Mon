import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { DEFAULT_TRADE_INTENT_SETTINGS, buildTradeIntentUrl } from './tradeIntentControls';
import { getIntentTone } from './tradeIntent';
import { TradeIntentSummary } from './TradeIntentSummary';

const NUMBER_FIELDS = [
  ['maxDistancePct', 'Max Distance %', '0', '0.05'],
  ['minNotional', 'Min Notional', '0', '1000000'],
  ['maxFreshnessMinutes', 'Max Freshness Minutes', '0', '5'],
  ['maxRiskDollars', 'Max Risk Dollars', '0', '50'],
  ['stopDistancePct', 'Stop Distance %', '0', '0.1'],
  ['rewardRiskRatio', 'Reward/Risk', '0', '0.25'],
  ['maxPositionNotional', 'Max Position Notional', '0', '1000'],
  ['maxQualityCautionFlags', 'Max Caution Flags', '0', '1'],
  ['minQualitySupportFlags', 'Min Support Flags', '0', '1'],
  ['minSourceConfirmationWeight', 'Min Source Weight', '0', '0.05'],
];

const TRADE_TOGGLES = [
  ['allowBuy', 'Buy'],
  ['allowSell', 'Sell'],
  ['includePulsePacket', 'Pulse'],
  ['requireSourceCoverageComplete', 'Source Gate'],
];

const CONFIRMATION_TOGGLES = [
  ['priceConfirmed', 'Price'],
  ['liquidityConfirmed', 'Liquidity'],
  ['newsChecked', 'News'],
];

export const TradeIntentView = () => {
  const [controls, setControls] = useState(DEFAULT_TRADE_INTENT_SETTINGS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateControl = (key, value) => {
    setControls((previous) => ({ ...previous, [key]: value }));
  };

  const fetchIntent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildTradeIntentUrl(controls));
      if (!res.ok) {
        throw new Error(`Trade intent request failed: ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Trade intent request failed');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIntent();
  }, []);

  const intent = result?.intent;
  const sentinel = result?.sentinel;
  const pulsePacket = result?.pulse_packet;
  const pulseStatus = result?.pulse_status;
  const confirmationSources = result?.confirmation_sources;
  const tone = getIntentTone(intent);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <div className="bg-dark-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-accent-cyan" style={{ color: 'var(--color-accent)' }} />
            <span className="text-white font-medium">Trade Intent Controls</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Symbol</span>
              <input
                value={controls.symbol}
                onChange={(event) => updateControl('symbol', event.target.value.toUpperCase())}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-400">Provider</span>
              <select
                value={controls.provider}
                onChange={(event) => updateControl('provider', event.target.value)}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="demo">Demo</option>
                <option value="finra">FINRA</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Minimum Score</span>
              <span className="text-sm font-mono text-white">{controls.minScore}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={controls.minScore}
              onChange={(event) => updateControl('minScore', Number(event.target.value))}
              className="w-full"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
            {NUMBER_FIELDS.map(([key, label, min, step]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs text-gray-400">{label}</span>
                <input
                  type="number"
                  min={min}
                  step={step}
                  value={controls[key]}
                  onChange={(event) => updateControl(key, Number(event.target.value))}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white font-mono"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TRADE_TOGGLES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateControl(key, !controls[key])}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  controls[key]
                    ? 'border-accent-cyan bg-dark-700 text-white'
                    : 'border-dark-600 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CONFIRMATION_TOGGLES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateControl(key, !controls[key])}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                  controls[key]
                    ? 'border-green-500/40 bg-green-500/15 text-green-200'
                    : 'border-dark-600 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Observed Spread Bps</span>
              <input
                type="number"
                min="0"
                step="1"
                value={controls.observedSpreadBps}
                onChange={(event) => updateControl('observedSpreadBps', Number(event.target.value))}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white font-mono"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-gray-400">Max Spread Bps</span>
              <input
                type="number"
                min="0"
                step="1"
                value={controls.maxSpreadBps}
                onChange={(event) => updateControl('maxSpreadBps', Number(event.target.value))}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white font-mono"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={fetchIntent}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-accent-cyan/20 text-accent-cyan hover:bg-accent-cyan/30 disabled:opacity-60"
            style={{ color: 'var(--color-accent)' }}
          >
            {loading ? 'Refreshing...' : 'Refresh Intent'}
          </button>
        </div>

        <div className="bg-dark-800 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-lg border text-sm font-medium ${tone.badgeClass}`}>
              {tone.label}
            </span>
            <span className="text-white font-mono">{intent?.symbol || controls.symbol}</span>
            <span className="text-sm text-gray-400">{result?.provider || controls.provider}</span>
            {sentinel && (
              <span className={`ml-auto text-xs px-2 py-1 rounded ${
                sentinel.status === 'approved' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
              }`}>
                Sentinel {sentinel.status}
              </span>
            )}
          </div>

          <TradeIntentSummary
            intent={intent}
            sentinel={sentinel}
            pulsePacket={pulsePacket}
            pulseStatus={pulseStatus}
            confirmationSources={confirmationSources}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
};
