export const DEFAULT_TRADE_INTENT_SETTINGS = {
  symbol: 'AAPL',
  provider: 'demo',
  minScore: 75,
  maxDistancePct: 1,
  minNotional: 25000000,
  maxFreshnessMinutes: 120,
  allowBuy: true,
  allowSell: true,
  includePulsePacket: true,
};

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const buildTradeIntentUrl = (settings = {}) => {
  const merged = { ...DEFAULT_TRADE_INTENT_SETTINGS, ...settings };
  const params = new URLSearchParams();
  params.set('symbol', String(merged.symbol || 'AAPL').trim().toUpperCase());
  params.set('provider', merged.provider || 'demo');
  params.set('min_score', String(asNumber(merged.minScore, DEFAULT_TRADE_INTENT_SETTINGS.minScore)));
  params.set('max_distance_pct', String(asNumber(merged.maxDistancePct, DEFAULT_TRADE_INTENT_SETTINGS.maxDistancePct)));
  params.set('min_notional', String(asNumber(merged.minNotional, DEFAULT_TRADE_INTENT_SETTINGS.minNotional)));
  params.set(
    'max_freshness_minutes',
    String(asNumber(merged.maxFreshnessMinutes, DEFAULT_TRADE_INTENT_SETTINGS.maxFreshnessMinutes))
  );
  params.set('allow_buy', String(Boolean(merged.allowBuy)));
  params.set('allow_sell', String(Boolean(merged.allowSell)));
  params.set('include_pulse_packet', String(Boolean(merged.includePulsePacket)));
  return `/darkpool/trade-intent?${params.toString()}`;
};

export const getIntentTone = (intent) => {
  if (!intent) {
    return {
      label: 'Waiting',
      badgeClass: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    };
  }
  if (intent.status === 'blocked' || intent.action === 'HOLD') {
    return {
      label: 'Blocked',
      badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    };
  }
  if (intent.action === 'BUY') {
    return {
      label: 'Buy Ready',
      badgeClass: 'bg-green-500/20 text-green-300 border-green-500/30',
    };
  }
  if (intent.action === 'SELL') {
    return {
      label: 'Sell Ready',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
  }
  return {
    label: 'Review',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };
};

export const summarizePulsePacket = (packet) => {
  if (!packet) {
    return 'Pulse packet withheld until Sentinel Edge approval.';
  }
  return `Pulse packet prepared for ${packet.symbol} ${packet.action} at ${Number(packet.confidence).toFixed(
    1
  )} confidence; manual execution still required.`;
};

export const formatIntentMoney = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
};
