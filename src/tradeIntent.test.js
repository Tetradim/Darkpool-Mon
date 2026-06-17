import { describe, expect, it } from 'vitest';

import {
  buildTradeIntentUrl,
  formatConfirmationSummary,
  formatConfidenceBreakdown,
  formatQualityFlags,
  formatRiskPlanSummary,
  formatSentinelChecks,
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
      '/darkpool/trade-intent?symbol=NVDA&provider=demo&min_score=82&max_distance_pct=0.75&min_notional=50000000&max_freshness_minutes=45&max_risk_dollars=750&stop_distance_pct=1.2&reward_risk_ratio=2.5&max_position_notional=40000&max_quality_caution_flags=2&min_quality_support_flags=1&min_source_confirmation_weight=0.35&price_confirmed=true&liquidity_confirmed=false&news_checked=true&observed_spread_bps=7&max_spread_bps=18&allow_buy=true&allow_sell=false&include_pulse_packet=true'
    );
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

  it('summarizes approved Pulse packets without implying live execution', () => {
    expect(
      summarizePulsePacket({
        action: 'BUY',
        symbol: 'AAPL',
        confidence: 91.25,
        risk_plan: { max_risk_dollars: 500, position_notional: 50000 },
      })
    ).toBe(
      'Pulse packet prepared for AAPL BUY at 91.3 confidence with $500 max risk and $50.00K planned notional; manual execution still required.'
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
