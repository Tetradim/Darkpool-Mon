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
  includePulsePacket: true,
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
  params.set('include_pulse_packet', String(Boolean(merged.includePulsePacket)));
  return `/darkpool/trade-intent?${params.toString()}`;
};
