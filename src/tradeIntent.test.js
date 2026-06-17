import { describe, expect, it } from 'vitest';

import {
  buildTradeIntentUrl,
  formatConfirmationSummary,
  formatRiskPlanSummary,
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
      '/darkpool/trade-intent?symbol=NVDA&provider=demo&min_score=82&max_distance_pct=0.75&min_notional=50000000&max_freshness_minutes=45&max_risk_dollars=750&stop_distance_pct=1.2&reward_risk_ratio=2.5&max_position_notional=40000&price_confirmed=true&liquidity_confirmed=false&news_checked=true&observed_spread_bps=7&max_spread_bps=18&allow_buy=true&allow_sell=false&include_pulse_packet=true'
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

describe('formatIntentMoney', () => {
  it('formats large notional values for scanning', () => {
    expect(formatIntentMoney(2075189210.68)).toBe('$2.08B');
  });
});
