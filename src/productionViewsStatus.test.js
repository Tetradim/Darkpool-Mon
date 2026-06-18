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
});
