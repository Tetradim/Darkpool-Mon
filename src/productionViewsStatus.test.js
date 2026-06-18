import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Production view request status wiring', () => {
  const source = readFileSync(new URL('./ProductionViews.jsx', import.meta.url), 'utf8');

  it('shows retryable request status in the Health workspace', () => {
    const healthViewSource = source.slice(source.indexOf('const HealthView = () => {'));

    expect(healthViewSource).toContain('setRequestError(buildRequestFailure(\'System Health\'');
    expect(healthViewSource).toContain('const healthStatus = summarizeRequestStatus({');
    expect(healthViewSource).toContain("label: 'System Health'");
    expect(healthViewSource).toContain('<RequestStatusBanner status={healthStatus} onRetry={fetchHealth} />');
  });

  it('wires route delivery filters into the Alerts workspace', () => {
    const alertsViewSource = source.slice(
      source.indexOf('const AlertsView = () => {'),
      source.indexOf('// Watchlist Component')
    );

    expect(alertsViewSource).toContain('const [routeStatusFilter, setRouteStatusFilter]');
    expect(alertsViewSource).toContain('routeStatus: routeStatusFilter');
    expect(alertsViewSource).toContain('triageSummary.sentRoutes');
    expect(alertsViewSource).toContain('ALERT_ROUTE_FILTERS.map');
    expect(alertsViewSource).toContain('Clear Filters');
  });
});
