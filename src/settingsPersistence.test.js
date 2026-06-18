import { describe, expect, it } from 'vitest';

import {
  buildSettingsProfileFilename,
  DASHBOARD_CONTROL_DEFAULTS,
  extractDashboardControls,
  mergeDashboardControls,
  normalizePersistedSettings,
  parseSettingsProfile,
  serializeSettingsProfile,
  summarizeSettingsProfile,
} from './settingsPersistence';
import { DEFAULT_SETTINGS } from './themes';

describe('settings persistence helpers', () => {
  it('hydrates persisted settings with modal and dashboard defaults', () => {
    const settings = normalizePersistedSettings({
      theme: 'MATRIX',
      provider: 'polygon',
      selectedStock: 'NVDA',
      threshold: 12,
      isRunning: false,
    });

    expect(settings).toMatchObject({
      ...DEFAULT_SETTINGS,
      ...DASHBOARD_CONTROL_DEFAULTS,
      theme: 'MATRIX',
      provider: 'polygon',
      selectedStock: 'NVDA',
      threshold: 12,
      isRunning: false,
    });
  });

  it('ignores invalid persisted payloads', () => {
    expect(normalizePersistedSettings(null)).toMatchObject({
      ...DEFAULT_SETTINGS,
      ...DASHBOARD_CONTROL_DEFAULTS,
    });
    expect(normalizePersistedSettings('not-json')).toMatchObject({
      ...DEFAULT_SETTINGS,
      ...DASHBOARD_CONTROL_DEFAULTS,
    });
  });

  it('preserves appearance and provider settings when dashboard controls change', () => {
    const merged = mergeDashboardControls(
      {
        theme: 'CYBERPUNK',
        provider: 'intrinio',
        intrinioApiKey: 'desk-key',
        soundEnabled: false,
      },
      {
        selectedStock: 'MSFT',
        timeframe: '4H',
        threshold: 8,
        whaleThreshold: 120,
        feedSort: 'LARGEST',
        isRunning: false,
      }
    );

    expect(merged).toMatchObject({
      theme: 'CYBERPUNK',
      provider: 'intrinio',
      intrinioApiKey: 'desk-key',
      soundEnabled: false,
      selectedStock: 'MSFT',
      timeframe: '4H',
      threshold: 8,
      whaleThreshold: 120,
      feedSort: 'LARGEST',
      isRunning: false,
    });
  });

  it('extracts dashboard controls with stable fallbacks', () => {
    expect(extractDashboardControls({ theme: 'FIRE', selectedStock: 'TSLA' })).toEqual({
      ...DASHBOARD_CONTROL_DEFAULTS,
      selectedStock: 'TSLA',
    });
  });

  it('serializes a portable settings profile with normalized settings', () => {
    const profile = JSON.parse(serializeSettingsProfile({
      theme: 'FIRE',
      provider: 'polygon',
      selectedStock: 'AAPL',
      threshold: 5,
    }, { exportedAt: '2026-06-18T12:00:00.000Z' }));

    expect(profile).toEqual({
      app: 'Darkpool-Mon',
      schemaVersion: 1,
      exportedAt: '2026-06-18T12:00:00.000Z',
      settings: {
        ...DEFAULT_SETTINGS,
        ...DASHBOARD_CONTROL_DEFAULTS,
        theme: 'FIRE',
        provider: 'polygon',
        selectedStock: 'AAPL',
        threshold: 5,
      },
    });
  });

  it('parses exported settings profiles and normalizes missing defaults', () => {
    const result = parseSettingsProfile(JSON.stringify({
      app: 'Darkpool-Mon',
      schemaVersion: 1,
      settings: {
        theme: 'MATRIX',
        selectedStock: 'NVDA',
      },
    }));

    expect(result).toEqual({
      ok: true,
      settings: {
        ...DEFAULT_SETTINGS,
        ...DASHBOARD_CONTROL_DEFAULTS,
        theme: 'MATRIX',
        selectedStock: 'NVDA',
      },
    });
  });

  it('parses a raw settings object for quick imports', () => {
    const result = parseSettingsProfile(JSON.stringify({
      theme: 'CYBERPUNK',
      feedSort: 'LARGEST',
    }));

    expect(result).toMatchObject({
      ok: true,
      settings: {
        theme: 'CYBERPUNK',
        feedSort: 'LARGEST',
      },
    });
  });

  it('returns a readable error for invalid profile JSON', () => {
    expect(parseSettingsProfile('{bad-json')).toEqual({
      ok: false,
      error: 'Profile JSON could not be parsed.',
    });
  });

  it('builds desk-readable profile filenames from symbol, provider, and timestamp', () => {
    expect(buildSettingsProfileFilename(
      {
        selectedStock: 'NVDA',
        provider: 'polygon',
      },
      new Date('2026-06-18T14:35:42.000Z')
    )).toBe('darkpool-mon-profile-nvda-polygon-2026-06-18-143542.json');
  });

  it('sanitizes profile filename parts when settings contain display text', () => {
    expect(buildSettingsProfileFilename(
      {
        selectedStock: 'ALL STOCKS',
        provider: 'paper / demo',
      },
      new Date('2026-06-18T14:35:42.000Z')
    )).toBe('darkpool-mon-profile-all-stocks-paper-demo-2026-06-18-143542.json');
  });

  it('summarizes the active profile into operator-facing cards', () => {
    expect(summarizeSettingsProfile({
      theme: 'MATRIX',
      provider: 'polygon',
      selectedStock: 'NVDA',
      threshold: 6,
      whaleThreshold: 140,
      feedSort: 'LARGEST',
      isRunning: false,
      soundEnabled: false,
      desktopAlerts: true,
      grafanaUrl: 'https://grafana.example/d/darkpool',
      plotlyUrl: '',
      discordWebhook: 'https://discord.example/webhook',
    })).toEqual([
      { label: 'Theme', value: 'MATRIX', detail: 'Chart style area' },
      { label: 'Provider', value: 'POLYGON', detail: 'External data source' },
      { label: 'Tape Filter', value: 'NVDA / $6M+', detail: 'Largest first' },
      { label: 'Whale Gate', value: '140K shares', detail: 'Simulation paused' },
      { label: 'Alerts', value: 'Desktop only', detail: 'Discord webhook configured' },
      { label: 'Integrations', value: 'Grafana linked', detail: 'Plotly not linked' },
    ]);
  });

  it('summarizes default profile settings without blank card text', () => {
    expect(summarizeSettingsProfile({})).toEqual([
      { label: 'Theme', value: 'DEFAULT', detail: 'Chart style area' },
      { label: 'Provider', value: 'FINRA', detail: 'External data source' },
      { label: 'Tape Filter', value: 'ALL / $1M+', detail: 'Latest first' },
      { label: 'Whale Gate', value: '50K shares', detail: 'Simulation live' },
      { label: 'Alerts', value: 'Sound only', detail: 'Discord webhook not set' },
      { label: 'Integrations', value: 'No external dashboards', detail: 'Plotly not linked' },
    ]);
  });
});
