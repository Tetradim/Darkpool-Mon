export const ALERT_STATE_FILTERS = ['all', 'new', 'acknowledged', 'snoozed', 'resolved'];
export const ALERT_SEVERITY_FILTERS = ['all', 'critical', 'high', 'medium', 'low'];

const normalizeOption = (value, options) => {
  const normalized = String(value || 'all').toLowerCase();
  return options.includes(normalized) ? normalized : 'all';
};

export const filterAlerts = (alerts = [], filters = {}) => {
  const state = normalizeOption(filters.state, ALERT_STATE_FILTERS);
  const severity = normalizeOption(filters.severity, ALERT_SEVERITY_FILTERS);

  return alerts.filter((alert) => {
    const stateMatches = state === 'all' || String(alert?.state || '').toLowerCase() === state;
    const severityMatches = severity === 'all' || String(alert?.severity || '').toLowerCase() === severity;
    return stateMatches && severityMatches;
  });
};
