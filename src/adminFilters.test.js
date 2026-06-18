import { describe, expect, it } from 'vitest';

import {
  filterAdminApiKeys,
  filterAdminAuditLogs,
  filterRetentionPolicies,
  summarizeAdminState,
} from './adminFilters';

describe('filterAdminApiKeys', () => {
  const keys = [
    { id: '1', provider: 'Polygon', key_masked: 'poly-***', status: 'active' },
    { id: '2', provider: 'Intrinio', key_masked: 'intr-***', status: 'inactive' },
    { id: '3', provider: 'Tradier', key_masked: 'trad-***', status: 'active' },
  ];

  it('filters API keys by query and status', () => {
    expect(filterAdminApiKeys(keys, { query: 'poly', status: 'active' })).toEqual([
      { id: '1', provider: 'Polygon', key_masked: 'poly-***', status: 'active' },
    ]);
    expect(filterAdminApiKeys(keys, { status: 'inactive' }).map((key) => key.id)).toEqual(['2']);
  });

  it('treats unknown status filters as all', () => {
    expect(filterAdminApiKeys(keys, { status: 'missing' }).map((key) => key.id)).toEqual(['1', '2', '3']);
  });
});

describe('filterAdminAuditLogs', () => {
  const logs = [
    { id: 'a', action: 'created watchlist', user: 'desk', ip_address: '10.0.0.1' },
    { id: 'b', action: 'rotated key', user: 'admin', ip_address: '10.0.0.2' },
  ];

  it('filters audit logs by action, user, and IP address', () => {
    expect(filterAdminAuditLogs(logs, { query: 'rotate' }).map((log) => log.id)).toEqual(['b']);
    expect(filterAdminAuditLogs(logs, { query: 'desk' }).map((log) => log.id)).toEqual(['a']);
    expect(filterAdminAuditLogs(logs, { query: '10.0.0.2' }).map((log) => log.id)).toEqual(['b']);
  });
});

describe('filterRetentionPolicies', () => {
  const policies = [
    { id: 'r1', name: 'Raw tape', duration_days: 7, auto_delete: true },
    { id: 'r2', name: 'Trade reviews', duration_days: 90, auto_delete: false },
  ];

  it('filters retention policies by query and mode', () => {
    expect(filterRetentionPolicies(policies, { query: 'raw', mode: 'auto' }).map((policy) => policy.id)).toEqual(['r1']);
    expect(filterRetentionPolicies(policies, { mode: 'manual' }).map((policy) => policy.id)).toEqual(['r2']);
  });
});

describe('summarizeAdminState', () => {
  it('summarizes admin operational state for dashboard cards', () => {
    expect(
      summarizeAdminState({
        apiKeys: [
          { status: 'active' },
          { status: 'inactive' },
          { status: 'active' },
        ],
        auditLogs: [
          { timestamp: '2026-06-18T12:00:00Z' },
          { timestamp: '2026-06-18T12:05:00Z' },
        ],
        retentionPolicies: [
          { auto_delete: true },
          { auto_delete: false },
        ],
      })
    ).toEqual({
      keyCount: 3,
      activeKeyCount: 2,
      auditLogCount: 2,
      autoDeletePolicyCount: 1,
      latestAuditAt: '2026-06-18T12:05:00Z',
    });
  });
});
