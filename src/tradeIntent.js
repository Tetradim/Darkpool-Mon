export const DEFAULT_TRADE_INTENT_SETTINGS = {
  symbol: 'AAPL',
  provider: 'demo',
  minScore: 75,
  maxDistancePct: 1,
  minNotional: 25000000,
  maxFreshnessMinutes: 120,
  maxRiskDollars: 500,
  stopDistancePct: 1,
  rewardRiskRatio: 2,
  maxPositionNotional: 50000,
  maxQualityCautionFlags: 99,
  minQualitySupportFlags: 0,
  priceConfirmed: false,
  liquidityConfirmed: false,
  newsChecked: false,
  observedSpreadBps: 0,
  maxSpreadBps: 25,
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
  params.set('max_risk_dollars', String(asNumber(merged.maxRiskDollars, DEFAULT_TRADE_INTENT_SETTINGS.maxRiskDollars)));
  params.set(
    'stop_distance_pct',
    String(asNumber(merged.stopDistancePct, DEFAULT_TRADE_INTENT_SETTINGS.stopDistancePct))
  );
  params.set(
    'reward_risk_ratio',
    String(asNumber(merged.rewardRiskRatio, DEFAULT_TRADE_INTENT_SETTINGS.rewardRiskRatio))
  );
  params.set(
    'max_position_notional',
    String(asNumber(merged.maxPositionNotional, DEFAULT_TRADE_INTENT_SETTINGS.maxPositionNotional))
  );
  params.set(
    'max_quality_caution_flags',
    String(asNumber(merged.maxQualityCautionFlags, DEFAULT_TRADE_INTENT_SETTINGS.maxQualityCautionFlags))
  );
  params.set(
    'min_quality_support_flags',
    String(asNumber(merged.minQualitySupportFlags, DEFAULT_TRADE_INTENT_SETTINGS.minQualitySupportFlags))
  );
  params.set('price_confirmed', String(Boolean(merged.priceConfirmed)));
  params.set('liquidity_confirmed', String(Boolean(merged.liquidityConfirmed)));
  params.set('news_checked', String(Boolean(merged.newsChecked)));
  params.set(
    'observed_spread_bps',
    String(asNumber(merged.observedSpreadBps, DEFAULT_TRADE_INTENT_SETTINGS.observedSpreadBps))
  );
  params.set('max_spread_bps', String(asNumber(merged.maxSpreadBps, DEFAULT_TRADE_INTENT_SETTINGS.maxSpreadBps)));
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
  if (packet.risk_plan) {
    return `Pulse packet prepared for ${packet.symbol} ${packet.action} at ${Number(packet.confidence).toFixed(
      1
    )} confidence with ${formatIntentMoney(packet.risk_plan.max_risk_dollars)} max risk and ${formatIntentMoney(
      packet.risk_plan.position_notional
    )} planned notional; manual execution still required.`;
  }
  return `Pulse packet prepared for ${packet.symbol} ${packet.action} at ${Number(packet.confidence).toFixed(
    1
  )} confidence; manual execution still required.`;
};

export const formatRiskPlanSummary = (riskPlan) => {
  if (!riskPlan) {
    return 'Risk plan unavailable.';
  }
  return `${riskPlan.estimated_shares} shares, stop $${Number(riskPlan.stop_price).toFixed(2)}, target $${Number(
    riskPlan.target_price
  ).toFixed(2)}, max risk ${formatIntentMoney(riskPlan.max_risk_dollars)}.`;
};

export const formatConfirmationSummary = (confirmation) => {
  if (!confirmation) {
    return 'Sentinel confirmation incomplete.';
  }
  const price = confirmation.price_confirmed ? 'Price confirmed' : 'Price unconfirmed';
  const liquidity = confirmation.liquidity_confirmed ? 'liquidity confirmed' : 'liquidity unconfirmed';
  const news = confirmation.news_checked ? 'news checked' : 'news unchecked';
  return `${price}, ${liquidity}, ${news}, spread ${Number(confirmation.observed_spread_bps).toFixed(0)}/${Number(
    confirmation.max_spread_bps
  ).toFixed(0)} bps.`;
};

export const formatConfidenceBreakdown = (breakdown) => {
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return ['Confidence breakdown unavailable.'];
  }
  return breakdown.map(
    (component) =>
      `${component.name}: ${Number(component.contribution).toFixed(1)}/${Number(component.max_contribution).toFixed(
        0
      )} - ${component.explanation}`
  );
};

export const formatQualityFlags = (flags) => {
  if (!Array.isArray(flags) || flags.length === 0) {
    return ['No quality flags available.'];
  }
  return flags.map((flag) => {
    const severity = String(flag.severity || 'info').toUpperCase();
    const source = flag.source || 'signal';
    return `${severity} ${source} - ${flag.message}`;
  });
};

export const formatSentinelChecks = (checks) => {
  if (!Array.isArray(checks) || checks.length === 0) {
    return ['Sentinel checklist unavailable.'];
  }
  return checks.map((check) => {
    const status = String(check.status || 'unknown').toUpperCase();
    const name = check.name || 'check';
    return `${status} ${name} - ${check.message}`;
  });
};

export const formatSourceConfirmationPlan = (plan) => {
  if (!plan || !Array.isArray(plan.sources) || plan.sources.length === 0) {
    return ['Source confirmation plan unavailable.'];
  }
  return plan.sources.map((source) => {
    const status = String(source.status || 'missing').toUpperCase();
    const priority = String(source.priority || 'context').toUpperCase();
    return `${status} ${priority} ${source.name} - ${source.role}`;
  });
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
    return `$${(amount / 1_000).toFixed(2)}K`;
  }
  return `$${amount.toFixed(0)}`;
};
