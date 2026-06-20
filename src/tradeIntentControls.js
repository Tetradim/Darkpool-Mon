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
  maxSessionDrawdownPct: 5,
  currentSessionDrawdownPct: 0,
  maxRegimeVolatilityPct: 10,
  maxQualityCautionFlags: 99,
  minQualitySupportFlags: 0,
  minSourceConfirmationWeight: 0,
  requireSourceCoverageComplete: true,
  sourceCoverageOverrideReason: '',
  priceConfirmed: false,
  liquidityConfirmed: false,
  newsChecked: false,
  observedSpreadBps: 0,
  maxSpreadBps: 25,
  allowBuy: true,
  allowSell: true,
  allowTrendUp: true,
  allowTrendDown: true,
  allowRangeBound: true,
  allowHighVolatility: false,
  allowInsufficientDataRegime: false,
  useVolatilityAdjustedStop: true,
  includePulsePacket: true,
};

export const TRADE_INTENT_PRESETS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default gate for routine desk review.',
    settings: {
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
      minSourceConfirmationWeight: 0,
      requireSourceCoverageComplete: true,
      allowBuy: true,
      allowSell: true,
      includePulsePacket: true,
    },
  },
  {
    id: 'momentum',
    label: 'Momentum',
    description: 'Wider scanner stance for faster tape moves.',
    settings: {
      minScore: 68,
      maxDistancePct: 1.5,
      minNotional: 15000000,
      maxFreshnessMinutes: 180,
      maxRiskDollars: 750,
      stopDistancePct: 1.25,
      rewardRiskRatio: 1.8,
      maxPositionNotional: 75000,
      maxQualityCautionFlags: 3,
      minQualitySupportFlags: 0,
      minSourceConfirmationWeight: 0.2,
      requireSourceCoverageComplete: true,
      allowBuy: true,
      allowSell: true,
      includePulsePacket: true,
    },
  },
  {
    id: 'defensive',
    label: 'Defensive',
    description: 'Tighter gate for high-conviction, low-noise review.',
    settings: {
      minScore: 88,
      maxDistancePct: 0.5,
      minNotional: 50000000,
      maxFreshnessMinutes: 45,
      maxRiskDollars: 250,
      stopDistancePct: 0.75,
      rewardRiskRatio: 2.5,
      maxPositionNotional: 25000,
      maxQualityCautionFlags: 1,
      minQualitySupportFlags: 2,
      minSourceConfirmationWeight: 0.6,
      requireSourceCoverageComplete: true,
      allowBuy: true,
      allowSell: true,
      includePulsePacket: true,
    },
  },
];

const OPERATOR_CONTEXT_KEYS = [
  'symbol',
  'provider',
  'priceConfirmed',
  'liquidityConfirmed',
  'newsChecked',
  'observedSpreadBps',
  'maxSpreadBps',
  'sourceCoverageOverrideReason',
];

export const applyTradeIntentPreset = (currentSettings = {}, presetId = 'balanced') => {
  const preset =
    TRADE_INTENT_PRESETS.find((candidate) => candidate.id === presetId) ||
    TRADE_INTENT_PRESETS[0];
  const preservedContext = OPERATOR_CONTEXT_KEYS.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(currentSettings, key)) {
      acc[key] = currentSettings[key];
    }
    return acc;
  }, {});

  return {
    ...DEFAULT_TRADE_INTENT_SETTINGS,
    ...preset.settings,
    ...preservedContext,
  };
};

const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value, fallback, min, max) => {
  const parsed = asNumber(value, fallback);
  return Math.min(max, Math.max(min, parsed));
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
    'max_session_drawdown_pct',
    String(asNumber(merged.maxSessionDrawdownPct, DEFAULT_TRADE_INTENT_SETTINGS.maxSessionDrawdownPct))
  );
  params.set(
    'current_session_drawdown_pct',
    String(asNumber(merged.currentSessionDrawdownPct, DEFAULT_TRADE_INTENT_SETTINGS.currentSessionDrawdownPct))
  );
  params.set(
    'max_regime_volatility_pct',
    String(asNumber(merged.maxRegimeVolatilityPct, DEFAULT_TRADE_INTENT_SETTINGS.maxRegimeVolatilityPct))
  );
  params.set(
    'max_quality_caution_flags',
    String(asNumber(merged.maxQualityCautionFlags, DEFAULT_TRADE_INTENT_SETTINGS.maxQualityCautionFlags))
  );
  params.set(
    'min_quality_support_flags',
    String(asNumber(merged.minQualitySupportFlags, DEFAULT_TRADE_INTENT_SETTINGS.minQualitySupportFlags))
  );
  params.set(
    'min_source_confirmation_weight',
    String(clampNumber(merged.minSourceConfirmationWeight, DEFAULT_TRADE_INTENT_SETTINGS.minSourceConfirmationWeight, 0, 1))
  );
  params.set('require_source_coverage_complete', String(Boolean(merged.requireSourceCoverageComplete)));
  const sourceCoverageOverrideReason = String(merged.sourceCoverageOverrideReason || '').trim();
  if (sourceCoverageOverrideReason) {
    params.set('source_coverage_override_reason', sourceCoverageOverrideReason);
  }
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
  params.set('allow_trend_up', String(Boolean(merged.allowTrendUp)));
  params.set('allow_trend_down', String(Boolean(merged.allowTrendDown)));
  params.set('allow_range_bound', String(Boolean(merged.allowRangeBound)));
  params.set('allow_high_volatility', String(Boolean(merged.allowHighVolatility)));
  params.set('allow_insufficient_data_regime', String(Boolean(merged.allowInsufficientDataRegime)));
  params.set('use_volatility_adjusted_stop', String(Boolean(merged.useVolatilityAdjustedStop)));
  params.set('include_pulse_packet', String(Boolean(merged.includePulsePacket)));
  return `/darkpool/trade-intent?${params.toString()}`;
};
