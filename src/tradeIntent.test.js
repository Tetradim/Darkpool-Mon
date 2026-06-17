import { describe, expect, it } from 'vitest';

import {
  buildTradeIntentUrl,
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
      allowBuy: true,
      allowSell: false,
      includePulsePacket: true,
    });

    expect(url).toBe(
      '/darkpool/trade-intent?symbol=NVDA&provider=demo&min_score=82&max_distance_pct=0.75&min_notional=50000000&max_freshness_minutes=45&allow_buy=true&allow_sell=false&include_pulse_packet=true'
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
    expect(summarizePulsePacket({ action: 'BUY', symbol: 'AAPL', confidence: 91.25 })).toBe(
      'Pulse packet prepared for AAPL BUY at 91.3 confidence; manual execution still required.'
    );
  });
});

describe('formatIntentMoney', () => {
  it('formats large notional values for scanning', () => {
    expect(formatIntentMoney(2075189210.68)).toBe('$2.08B');
  });
});
