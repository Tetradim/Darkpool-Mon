const ONLINE_STATUSES = new Set(['connected', 'healthy', 'online']);
const DEGRADED_STATUSES = new Set(['degraded', 'stale', 'warning']);

const TONES = {
  healthy: {
    label: 'Healthy',
    toneClass: 'border-green-500/30 bg-green-500/10 text-green-200',
    summary: 'Feeds are current and connectors are online.',
  },
  degraded: {
    label: 'Degraded',
    toneClass: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
    summary: 'Monitor latency or connector quality needs attention.',
  },
  critical: {
    label: 'Critical',
    toneClass: 'border-red-500/30 bg-red-500/10 text-red-200',
    summary: 'Operator intervention is required before relying on live signals.',
  },
};

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const getSourceStatusGroup = (source) => {
  const status = String(source?.status || 'offline').toLowerCase();
  if (ONLINE_STATUSES.has(status)) return 'online';
  if (DEGRADED_STATUSES.has(status)) return 'degraded';
  return 'offline';
};

const countConnectors = (sources = []) => {
  return sources.reduce(
    (acc, source) => {
      const statusGroup = getSourceStatusGroup(source);
      if (statusGroup === 'online') {
        acc.online += 1;
      } else if (statusGroup === 'degraded') {
        acc.degraded += 1;
      } else {
        acc.offline += 1;
      }
      acc.total += 1;
      return acc;
    },
    { online: 0, degraded: 0, offline: 0, total: 0 }
  );
};

const matchesSourceQuery = (source, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [source?.name, source?.provider, source?.status].some((value) => {
    return String(value || '').toLowerCase().includes(normalizedQuery);
  });
};

export const filterDataSources = (sources = [], filters = {}) => {
  const normalizedStatus = String(filters.status || 'all').toLowerCase();
  const allowedStatus = ['all', 'online', 'degraded', 'offline'].includes(normalizedStatus)
    ? normalizedStatus
    : 'all';

  return sources.filter((source) => {
    const statusMatches = allowedStatus === 'all' || getSourceStatusGroup(source) === allowedStatus;
    return statusMatches && matchesSourceQuery(source, filters.query);
  });
};

export const summarizeDataSources = (sources = []) => {
  const connectorCounts = countConnectors(sources);
  const totalEvents = sources.reduce((acc, source) => acc + Number(source?.events_received || 0), 0);
  const totalLag = sources.reduce((acc, source) => acc + Number(source?.feed_lag_ms || 0), 0);
  const averageLagMs = sources.length > 0 ? Math.round(totalLag / sources.length) : 0;
  const worstSource = sources
    .slice()
    .sort((left, right) => Number(right?.feed_lag_ms || 0) - Number(left?.feed_lag_ms || 0))[0];
  const onlinePct = connectorCounts.total > 0
    ? Math.round((connectorCounts.online / connectorCounts.total) * 1000) / 10
    : 0;

  return {
    totalEvents,
    averageLagMs,
    worstLag: {
      name: worstSource?.name || 'N/A',
      feed_lag_ms: Number(worstSource?.feed_lag_ms || 0),
    },
    onlinePct,
    tone: connectorCounts.offline > 0 ? 'critical' : connectorCounts.degraded > 0 ? 'degraded' : 'healthy',
  };
};

export const summarizeHealthStatus = (health = {}, sources = []) => {
  const feedLag = Number(health.feed_lag_ms || 0);
  const droppedEvents = Number(health.dropped_events || 0);
  const parserErrors = Number(health.parser_errors || 0);
  const cpuUsage = Number(health.cpu_usage_pct || 0);
  const connectorCounts = countConnectors(sources);

  const criticalReasons = [];
  const warningReasons = [];

  if (feedLag >= 2000) criticalReasons.push(`Feed lag ${feedLag}ms`);
  else if (feedLag >= 500) warningReasons.push(`Feed lag ${feedLag}ms`);

  if (droppedEvents >= 50) criticalReasons.push(`${droppedEvents} dropped events`);
  else if (droppedEvents > 10) warningReasons.push(`${droppedEvents} dropped events`);

  if (parserErrors >= 10) criticalReasons.push(`${parserErrors} parser errors`);
  else if (parserErrors > 5) warningReasons.push(`${parserErrors} parser errors`);

  if (cpuUsage >= 95) criticalReasons.push(`CPU ${cpuUsage}%`);
  else if (cpuUsage >= 75) warningReasons.push(`CPU ${cpuUsage}%`);

  if (connectorCounts.offline > 0) {
    warningReasons.push(`${pluralize(connectorCounts.offline, 'connector')} offline`);
  }
  if (connectorCounts.degraded > 0) {
    warningReasons.push(`${pluralize(connectorCounts.degraded, 'connector')} degraded`);
  }

  const status = criticalReasons.length > 0 ? 'critical' : warningReasons.length > 0 ? 'degraded' : 'healthy';
  const connectorSummary = `${connectorCounts.online}/${connectorCounts.total} connectors online`;
  const tone = TONES[status];

  return {
    status,
    label: tone.label,
    toneClass: tone.toneClass,
    summary: tone.summary,
    reasons: [...criticalReasons, ...warningReasons, connectorSummary],
    connectorCounts,
  };
};
