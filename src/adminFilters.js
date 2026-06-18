const matchesQuery = (fields, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  return fields.some((field) => String(field || '').toLowerCase().includes(normalizedQuery));
};

const normalizeStatus = (status) => {
  const normalized = String(status || 'all').toLowerCase();
  return ['all', 'active', 'inactive'].includes(normalized) ? normalized : 'all';
};

const normalizeRetentionMode = (mode) => {
  const normalized = String(mode || 'all').toLowerCase();
  return ['all', 'auto', 'manual'].includes(normalized) ? normalized : 'all';
};

export const filterAdminApiKeys = (keys = [], filters = {}) => {
  const status = normalizeStatus(filters.status);
  return keys.filter((key) => {
    const statusMatches = status === 'all' || String(key?.status || '').toLowerCase() === status;
    return statusMatches && matchesQuery([key?.provider, key?.key_masked, key?.status], filters.query);
  });
};

export const filterAdminAuditLogs = (logs = [], filters = {}) => {
  return logs.filter((log) => {
    return matchesQuery([log?.action, log?.user, log?.ip_address], filters.query);
  });
};

export const filterRetentionPolicies = (policies = [], filters = {}) => {
  const mode = normalizeRetentionMode(filters.mode);
  return policies.filter((policy) => {
    const modeMatches =
      mode === 'all' ||
      (mode === 'auto' && Boolean(policy?.auto_delete)) ||
      (mode === 'manual' && !policy?.auto_delete);
    return modeMatches && matchesQuery([policy?.name, policy?.duration_days], filters.query);
  });
};

export const summarizeAdminState = ({ apiKeys = [], auditLogs = [], retentionPolicies = [] } = {}) => {
  const latestAudit = auditLogs
    .slice()
    .sort((left, right) => new Date(right?.timestamp || 0).getTime() - new Date(left?.timestamp || 0).getTime())[0];

  return {
    keyCount: apiKeys.length,
    activeKeyCount: apiKeys.filter((key) => String(key?.status || '').toLowerCase() === 'active').length,
    auditLogCount: auditLogs.length,
    autoDeletePolicyCount: retentionPolicies.filter((policy) => Boolean(policy?.auto_delete)).length,
    latestAuditAt: latestAudit?.timestamp || null,
  };
};
