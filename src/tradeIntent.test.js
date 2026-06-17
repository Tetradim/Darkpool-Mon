import { describe, expect, it } from 'vitest';

import {
  buildTradeIntentUrl,
  formatConfirmationSummary,
  formatConfidenceBreakdown,
  formatQualityFlags,
  formatRiskPlanSummary,
  formatSentinelChecks,
  formatMissingSourceCoverage,
  formatSourceCoverage,
  formatSourceConfirmationPlan,
  formatSourceAdjustedConfidence,
  formatIntentMoney,
  getIntentTone,
  summarizePulsePacket,
} from './tradeIntent';

describe('buildTradeIntentUrl', () => {
  it('serializes user threshold preferences for the backend gate', () => {
    const url = buildTradeIntentUrl({
      symbol: 'nvda',
      provider: 'demo',
      minScore: 82,
      maxDistancePct: 0.75,
      minNotional: 50000000,
      maxFreshnessMinutes: 45,
      maxRiskDollars: 750,
      stopDistancePct: 1.2,
      rewardRiskRatio: 2.5,
      maxPositionNotional: 40000,
      maxQualityCautionFlags: 2,
      minQualitySupportFlags: 1,
      minSourceConfirmationWeight: 0.35,
      requireSourceCoverageComplete: true,
      sourceCoverageOverrideReason: 'manual-check',
      priceConfirmed: true,
      liquidityConfirmed: false,
      newsChecked: true,
      observedSpreadBps: 7,
      maxSpreadBps: 18,
      allowBuy: true,
      allowSell: false,
      includePulsePacket: true,
    });

    expect(url).toBe(
      '/darkpool/trade-intent?symbol=NVDA&provider=demo&min_score=82&max_distance_pct=0.75&min_notional=50000000&max_freshness_minutes=45&max_risk_dollars=750&stop_distance_pct=1.2&reward_risk_ratio=2.5&max_position_notional=40000&max_quality_caution_flags=2&min_quality_support_flags=1&min_source_confirmation_weight=0.35&require_source_coverage_complete=true&source_coverage_override_reason=manual-check&price_confirmed=true&liquidity_confirmed=false&news_checked=true&observed_spread_bps=7&max_spread_bps=18&allow_buy=true&allow_sell=false&include_pulse_packet=true'
    );
  });

  it('clamps source confirmation threshold to the normalized readiness range', () => {
    const highUrl = buildTradeIntentUrl({ minSourceConfirmationWeight: 1.25 });
    const lowUrl = buildTradeIntentUrl({ minSourceConfirmationWeight: -0.4 });
    const highParams = new URLSearchParams(highUrl.split('?')[1]);
    const lowParams = new URLSearchParams(lowUrl.split('?')[1]);

    expect(highParams.get('min_source_confirmation_weight')).toBe('1');
    expect(lowParams.get('min_source_confirmation_weight')).toBe('0');
  });
});

describe('getIntentTone', () => {
  it('uses a safe hold tone when the intent is blocked', () => {
    const tone = getIntentTone({ status: 'blocked', action: 'HOLD' });

    expect(tone.label).toBe('Blocked');
    expect(tone.badgeClass).toContain('text-yellow-300');
  });

  it('uses directional tones for Sentinel-ready buy and sell intents', () => {
    expect(getIntentTone({ status: 'ready_for_sentinel', action: 'BUY' }).badgeClass).toContain('text-green-300');
    expect(getIntentTone({ status: 'ready_for_sentinel', action: 'SELL' }).badgeClass).toContain('text-red-300');
  });
});

describe('summarizePulsePacket', () => {
  it('states that Pulse is waiting when no packet exists', () => {
    expect(summarizePulsePacket(null)).toBe('Pulse packet withheld until Sentinel Edge approval.');
  });

  it('uses Pulse status to distinguish disabled packet preparation', () => {
    expect(
      summarizePulsePacket(null, {
        status: 'not_requested',
        message: 'Pulse communication was not requested for this review.',
        reasons: ['include_pulse_packet=false'],
      })
    ).toBe('Pulse communication was not requested for this review. Reasons: include_pulse_packet=false');
  });

  it('uses Pulse status reasons when Sentinel withholds packet preparation', () => {
    expect(
      summarizePulsePacket(null, {
        status: 'withheld',
        message: 'Pulse communication withheld until Sentinel Edge approval is complete.',
        reasons: ['price confirmation required before Pulse'],
      })
    ).toBe(
      'Pulse communication withheld until Sentinel Edge approval is complete. Reasons: price confirmation required before Pulse'
    );
  });

  it('summarizes approved Pulse packets without implying live execution', () => {
    expect(
      summarizePulsePacket({
        action: 'BUY',
        symbol: 'AAPL',
        confidence: 91.25,
        source_adjusted_confidence: 68.5,
        risk_plan: { max_risk_dollars: 500, position_notional: 50000 },
      })
    ).toBe(
      'Pulse packet prepared for AAPL BUY at 91.3 raw / 68.5 source-adjusted confidence with $500 max risk and $50.00K planned notional; manual execution still required.'
    );
  });

  it('warns when a prepared Pulse packet used an incomplete source-coverage override', () => {
    expect(
      summarizePulsePacket({
        action: 'BUY',
        symbol: 'AAPL',
        confidence: 91.25,
        source_adjusted_confidence: 68.5,
        required_source_coverage_complete: false,
        source_coverage_override_reason: 'Manual vendor check completed before demo Pulse review.',
        missing_required_source_coverage: ['Real-time price/NBBO confirmation', 'Trading halt/LULD blocker'],
        risk_plan: { max_risk_dollars: 500, position_notional: 50000 },
      })
    ).toBe(
      'Pulse packet prepared for AAPL BUY at 91.3 raw / 68.5 source-adjusted confidence with $500 max risk and $50.00K planned notional; manual execution still required. Source coverage incomplete: Missing Real-time price/NBBO confirmation; Missing Trading halt/LULD blocker. Override reason: Manual vendor check completed before demo Pulse review.'
    );
  });
});

describe('formatRiskPlanSummary', () => {
  it('summarizes missing risk plans as unavailable', () => {
    expect(formatRiskPlanSummary(null)).toBe('Risk plan unavailable.');
  });

  it('summarizes stop, target, shares, and max risk for quick operator scanning', () => {
    expect(
      formatRiskPlanSummary({
        estimated_shares: 278,
        stop_price: 178.2,
        target_price: 183.6,
        max_risk_dollars: 500,
      })
    ).toBe('278 shares, stop $178.20, target $183.60, max risk $500.');
  });

  it('includes the planned side when a risk envelope belongs to a blocked candidate', () => {
    expect(
      formatRiskPlanSummary({
        planned_action: 'SELL',
        estimated_shares: 278,
        entry_price: 179.4,
        stop_price: 181.8,
        target_price: 176.4,
        max_risk_dollars: 500,
        risk_per_share: 2.4,
        reward_per_share: 3.0,
        estimated_loss_dollars: 333.6,
        estimated_gain_dollars: 834.0,
      })
    ).toBe(
      'SELL plan: 278 shares, entry $179.40, stop $181.80, target $176.40, risk/share $2.40, reward/share $3.00, est loss $334, est gain $834, max risk $500.'
    );
  });
});

describe('formatConfirmationSummary', () => {
  it('summarizes missing confirmation state as incomplete', () => {
    expect(formatConfirmationSummary(null)).toBe('Sentinel confirmation incomplete.');
  });

  it('summarizes confirmed price, liquidity, news, and spread state', () => {
    expect(
      formatConfirmationSummary({
        price_confirmed: true,
        liquidity_confirmed: true,
        news_checked: true,
        observed_spread_bps: 7,
        max_spread_bps: 18,
      })
    ).toBe('Price confirmed, liquidity confirmed, news checked, spread 7/18 bps.');
  });
});

describe('formatConfidenceBreakdown', () => {
  it('summarizes missing breakdowns as unavailable', () => {
    expect(formatConfidenceBreakdown(null)).toEqual(['Confidence breakdown unavailable.']);
  });

  it('formats named score components for operator scanning', () => {
    expect(
      formatConfidenceBreakdown([
        { name: 'Dark pool level', contribution: 50.6, max_contribution: 55, explanation: 'level strength 92.0' },
        { name: 'Price proximity', contribution: 12, max_contribution: 12, explanation: 'spot within range' },
      ])
    ).toEqual([
      'Dark pool level: 50.6/55 - level strength 92.0',
      'Price proximity: 12.0/12 - spot within range',
    ]);
  });
});

describe('formatQualityFlags', () => {
  it('summarizes missing quality flags as unavailable', () => {
    expect(formatQualityFlags(null)).toEqual(['No quality flags available.']);
  });

  it('formats severity, source, and message for operator scanning', () => {
    expect(
      formatQualityFlags([
        {
          severity: 'caution',
          source: 'options_flow',
          message: '1 options flow item(s) conflict with BUY',
        },
      ])
    ).toEqual(['CAUTION options_flow - 1 options flow item(s) conflict with BUY']);
  });
});

describe('formatSentinelChecks', () => {
  it('summarizes missing checklist state as unavailable', () => {
    expect(formatSentinelChecks(null)).toEqual(['Sentinel checklist unavailable.']);
  });

  it('formats check status and message for operator scanning', () => {
    expect(
      formatSentinelChecks([
        {
          name: 'price_confirmation',
          status: 'failed',
          message: 'price confirmation required before Pulse',
        },
      ])
    ).toEqual(['FAILED price_confirmation - price confirmation required before Pulse']);
  });
});

describe('formatSourceConfirmationPlan', () => {
  it('summarizes missing source plans as unavailable', () => {
    expect(formatSourceConfirmationPlan(null)).toEqual(['Source confirmation plan unavailable.']);
  });

  it('formats source status, priority, and confirmation role for operator scanning', () => {
    expect(
      formatSourceConfirmationPlan({
        sources: [
          {
            name: 'SIP/NBBO feed',
            status: 'missing',
            priority: 'required',
            role: 'price_confirmation',
          },
        ],
      })
    ).toEqual(['MISSING REQUIRED SIP/NBBO feed - price_confirmation']);
  });
});

describe('formatSourceCoverage', () => {
  it('summarizes missing source coverage as unavailable', () => {
    expect(formatSourceCoverage(null)).toEqual(['Source coverage unavailable.']);
  });

  it('formats role-level coverage for operator scanning', () => {
    expect(
      formatSourceCoverage([
        {
          role: 'price_confirmation',
          label: 'Real-time price/NBBO confirmation',
          required: true,
          status: 'missing',
          explanation: 'Real-time price/NBBO confirmation is missing; configure SIP/NBBO feed.',
        },
      ])
    ).toEqual([
      'MISSING REQUIRED Real-time price/NBBO confirmation - Real-time price/NBBO confirmation is missing; configure SIP/NBBO feed.',
    ]);
  });
});

describe('formatMissingSourceCoverage', () => {
  it('summarizes missing required coverage as unavailable', () => {
    expect(formatMissingSourceCoverage(null)).toEqual([]);
  });

  it('formats structured missing coverage labels for operator review', () => {
    expect(formatMissingSourceCoverage(['Real-time price/NBBO confirmation', 'Trading halt/LULD blocker'])).toEqual([
      'Missing Real-time price/NBBO confirmation',
      'Missing Trading halt/LULD blocker',
    ]);
  });
});

describe('formatSourceAdjustedConfidence', () => {
  it('summarizes missing adjusted confidence as unavailable', () => {
    expect(formatSourceAdjustedConfidence(null)).toBe('Source-adjusted confidence unavailable.');
  });

  it('summarizes source-adjusted confidence against raw confidence', () => {
    expect(
      formatSourceAdjustedConfidence({
        confidence: 82,
        source_adjusted_confidence: 28.7,
        source_confirmation_weight: 0.35,
      })
    ).toBe('28.7 source-adjusted from 82.0 raw at 0.35 source weight.');
  });
});

describe('formatIntentMoney', () => {
  it('formats large notional values for scanning', () => {
    expect(formatIntentMoney(2075189210.68)).toBe('$2.08B');
  });
});
