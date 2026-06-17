export { DEFAULT_TRADE_INTENT_SETTINGS, buildTradeIntentUrl } from './tradeIntentControls';

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

const formatPulseStatusReasons = (pulseStatus) => {
  if (!Array.isArray(pulseStatus?.reasons) || pulseStatus.reasons.length === 0) {
    return '';
  }
  return ` Reasons: ${pulseStatus.reasons.join(' ')}`;
};

export const formatMissingSourceCoverage = (missingCoverage) => {
  if (!Array.isArray(missingCoverage) || missingCoverage.length === 0) {
    return [];
  }
  return missingCoverage.map((label) => `Missing ${label}`);
};

const formatPreparedPulseCoverageWarning = (packet) => {
  if (packet?.required_source_coverage_complete !== false) {
    return '';
  }
  const missingCoverage = formatMissingSourceCoverage(packet.missing_required_source_coverage);
  if (missingCoverage.length === 0) {
    return ' Source coverage incomplete.';
  }
  return ` Source coverage incomplete: ${missingCoverage.join('; ')}.`;
};

export const summarizePulsePacket = (packet, pulseStatus = null) => {
  if (!packet) {
    if (pulseStatus?.message) {
      return `${pulseStatus.message}${formatPulseStatusReasons(pulseStatus)}`;
    }
    return 'Pulse packet withheld until Sentinel Edge approval.';
  }
  const rawConfidence = Number(packet.confidence).toFixed(1);
  const confidence = Number.isFinite(Number(packet.source_adjusted_confidence))
    ? `${rawConfidence} raw / ${Number(packet.source_adjusted_confidence).toFixed(1)} source-adjusted`
    : rawConfidence;
  if (packet.risk_plan) {
    const summary = `Pulse packet prepared for ${packet.symbol} ${packet.action} at ${confidence} confidence with ${formatIntentMoney(
      packet.risk_plan.max_risk_dollars
    )} max risk and ${formatIntentMoney(
      packet.risk_plan.position_notional
    )} planned notional; manual execution still required.`;
    return `${summary}${formatPreparedPulseCoverageWarning(packet)}`;
  }
  const summary = `Pulse packet prepared for ${packet.symbol} ${packet.action} at ${confidence} confidence; manual execution still required.`;
  return `${summary}${formatPreparedPulseCoverageWarning(packet)}`;
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

export const formatSourceCoverage = (coverage) => {
  if (!Array.isArray(coverage) || coverage.length === 0) {
    return ['Source coverage unavailable.'];
  }
  return coverage.map((item) => {
    const status = String(item.status || 'missing').toUpperCase();
    const required = item.required ? ' REQUIRED' : '';
    const label = item.label || item.role || 'Source coverage';
    return `${status}${required} ${label} - ${item.explanation}`;
  });
};

export const formatSourceAdjustedConfidence = (intent) => {
  if (!intent) {
    return 'Source-adjusted confidence unavailable.';
  }
  return `${Number(intent.source_adjusted_confidence).toFixed(1)} source-adjusted from ${Number(
    intent.confidence
  ).toFixed(1)} raw at ${Number(intent.source_confirmation_weight).toFixed(2)} source weight.`;
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
