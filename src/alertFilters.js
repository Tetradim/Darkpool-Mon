export const ALERT_STATE_FILTERS = ['all', 'new', 'acknowledged', 'snoozed', 'resolved'];
export const ALERT_SEVERITY_FILTERS = ['all', 'critical', 'high', 'medium', 'low'];

const normalizeOption = (value, options) => {
  const normalized = String(value || 'all').toLowerCase();
  return options.includes(normalized) ? normalized : 'all';
};

const matchesQuery = (alert, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    alert?.symbol,
    alert?.alert_type,
    alert?.channel,
    alert?.routing_status,
    alert?.dedup_reason,
  ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
};

const isActionableAlert = (alert) => {
  return (
    String(alert?.state || '').toLowerCase() === 'new' ||
    String(alert?.routing_status || '').toLowerCase() === 'failed'
  );
};

export const filterAlerts = (alerts = [], filters = {}) => {
  const state = normalizeOption(filters.state, ALERT_STATE_FILTERS);
  const severity = normalizeOption(filters.severity, ALERT_SEVERITY_FILTERS);
  const query = filters.query;
  const actionableOnly = Boolean(filters.actionableOnly);

  return alerts.filter((alert) => {
    const stateMatches = state === 'all' || String(alert?.state || '').toLowerCase() === state;
    const severityMatches = severity === 'all' || String(alert?.severity || '').toLowerCase() === severity;
    const actionMatches = !actionableOnly || isActionableAlert(alert);
    return stateMatches && severityMatches && actionMatches && matchesQuery(alert, query);
  });
};

export const summarizeAlertTriage = (alerts = []) => {
  const total = alerts.length;
  const actionable = alerts.filter(isActionableAlert).length;
  const criticalOpen = alerts.filter((alert) => {
    return (
      String(alert?.severity || '').toLowerCase() === 'critical' &&
      String(alert?.state || '').toLowerCase() !== 'resolved'
    );
  }).length;
  const failedRoutes = alerts.filter((alert) => String(alert?.routing_status || '').toLowerCase() === 'failed').length;
  const snoozed = alerts.filter((alert) => String(alert?.state || '').toLowerCase() === 'snoozed').length;
  const resolved = alerts.filter((alert) => String(alert?.state || '').toLowerCase() === 'resolved').length;

  return {
    total,
    actionable,
    criticalOpen,
    failedRoutes,
    snoozed,
    resolved,
    tone: criticalOpen > 0 || failedRoutes > 0 ? 'urgent' : actionable > 0 ? 'active' : 'quiet',
  };
};
