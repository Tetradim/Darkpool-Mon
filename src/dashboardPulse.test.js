import { describe, expect, it } from 'vitest';

import { summarizeDashboardPulse } from './dashboardPulse';

describe('summarizeDashboardPulse', () => {
  it('returns a neutral operator brief when the tape is empty', () => {
    expect(summarizeDashboardPulse([], [], { whaleThresholdK: 50 })).toEqual({
      totalNotional: 0,
      bias: {
        state: 'neutral',
        label: 'Balanced tape',
        buyRatio: 50,
        sellRatio: 50,
        summary: 'Waiting for qualifying prints',
        toneClass: 'border-dark-600 bg-dark-800 text-gray-300',
      },
      leader: {
        symbol: 'N/A',
        label: 'No leader',
        trades: 0,
        notional: 0,
        dominantSide: 'N/A',
      },
      whales: {
        count: 0,
        thresholdShares: 50000,
        label: 'No whale prints',
        toneClass: 'border-dark-600 bg-dark-800 text-gray-300',
      },
      focusQueue: [],
      latestAlert: {
        label: 'No alerts',
        symbol: 'N/A',
        reason: 'Alerts appear when the simulation detects whale prints or z-score spikes.',
      },
    });
  });

  it('detects buy pressure and the leading symbol by notional value', () => {
    const pulse = summarizeDashboardPulse(
      [
        { symbol: 'NVDA', direction: 'BUY', size: 70000, value: 42000000 },
        { symbol: 'NVDA', direction: 'BUY', size: 20000, value: 12000000 },
        { symbol: 'AAPL', direction: 'SELL', size: 30000, value: 9000000 },
      ],
      [],
      { whaleThresholdK: 50 }
    );

    expect(pulse.bias).toMatchObject({
      state: 'buy',
      label: 'Buy pressure',
      buyRatio: 85.7,
      sellRatio: 14.3,
    });
    expect(pulse.bias.summary).toBe('$54.0M buy vs $9.0M sell');
    expect(pulse.leader).toEqual({
      symbol: 'NVDA',
      label: 'NVDA leading',
      trades: 2,
      notional: 54000000,
      dominantSide: 'BUY',
    });
    expect(pulse.whales).toMatchObject({
      count: 1,
      thresholdShares: 50000,
      label: '1 whale print',
    });
  });

  it('builds a ranked focus queue with side bias and whale pressure', () => {
    const pulse = summarizeDashboardPulse(
      [
        { symbol: 'NVDA', direction: 'BUY', size: 70000, value: 42000000 },
        { symbol: 'NVDA', direction: 'SELL', size: 65000, value: 39000000 },
        { symbol: 'MSFT', direction: 'BUY', size: 30000, value: 15000000 },
        { symbol: 'AAPL', direction: 'SELL', size: 90000, value: 22000000 },
        { symbol: 'AAPL', direction: 'SELL', size: 15000, value: 4000000 },
      ],
      [],
      { whaleThresholdK: 60, focusLimit: 2 }
    );

    expect(pulse.focusQueue).toEqual([
      {
        symbol: 'NVDA',
        notional: 81000000,
        trades: 2,
        whaleCount: 2,
        dominantSide: 'BUY',
        buyRatio: 51.9,
        label: 'NVDA mixed pressure',
        toneClass: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
      },
      {
        symbol: 'AAPL',
        notional: 26000000,
        trades: 2,
        whaleCount: 1,
        dominantSide: 'SELL',
        buyRatio: 0,
        label: 'AAPL sell skew',
        toneClass: 'border-red-500/30 bg-red-500/10 text-red-200',
      },
    ]);
  });

  it('detects sell pressure and exposes the latest alert context', () => {
    const pulse = summarizeDashboardPulse(
      [
        { symbol: 'MSFT', direction: 'SELL', size: 90000, value: 36000000 },
        { symbol: 'TSLA', direction: 'BUY', size: 12000, value: 3000000 },
      ],
      [
        { symbol: 'MSFT', reason: 'Whale print 90.0K shares' },
        { symbol: 'TSLA', reason: 'Older alert' },
      ],
      { whaleThresholdK: 75 }
    );

    expect(pulse.bias).toMatchObject({
      state: 'sell',
      label: 'Sell pressure',
      buyRatio: 7.7,
      sellRatio: 92.3,
    });
    expect(pulse.latestAlert).toEqual({
      label: 'Latest alert',
      symbol: 'MSFT',
      reason: 'Whale print 90.0K shares',
    });
    expect(pulse.whales.count).toBe(1);
  });
});
