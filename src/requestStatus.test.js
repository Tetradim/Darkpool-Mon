import { describe, expect, it } from 'vitest';

const loadModule = async () => import('./requestStatus.js').catch(() => ({}));

describe('request status helpers', () => {
  it('builds operator-facing errors from failed HTTP responses', async () => {
    const { buildRequestFailure } = await loadModule();

    expect(buildRequestFailure?.('Scanner', { status: 503 })).toEqual({
      title: 'Scanner unavailable',
      detail: 'Request failed with HTTP 503.',
      tone: 'error',
    });
  });

  it('builds operator-facing errors from thrown network failures', async () => {
    const { buildRequestFailure } = await loadModule();

    expect(buildRequestFailure?.('Watchlists', new Error('Failed to fetch'))).toEqual({
      title: 'Watchlists unavailable',
      detail: 'Failed to fetch',
      tone: 'error',
    });
  });

  it('summarizes stale data when a refresh fails after data was already loaded', async () => {
    const { summarizeRequestStatus } = await loadModule();

    expect(summarizeRequestStatus?.({
      label: 'Alerts',
      loading: false,
      error: { title: 'Alerts unavailable', detail: 'Request failed with HTTP 500.', tone: 'error' },
      itemCount: 12,
    })).toEqual({
      title: 'Alerts data may be stale',
      detail: 'Showing 12 previously loaded records. Request failed with HTTP 500.',
      tone: 'warning',
    });
  });
});
