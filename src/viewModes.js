export const VIEW_MODES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Live tape, volume, and alert overview',
  },
  {
    id: 'intent',
    label: 'Intent',
    description: 'Sentinel trade intent review',
  },
  {
    id: 'options',
    label: 'Options',
    description: 'Options flow and exposure dashboard',
  },
  {
    id: 'scanner',
    label: 'Scanner',
    description: 'Filtered dark-pool print scanner',
  },
  {
    id: 'flowmap',
    label: 'Flow Map',
    description: 'Cross-symbol flow relationship view',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    description: 'Alert trigger log and routing status',
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    description: 'Saved symbol groups and desk lists',
  },
  {
    id: 'replay',
    label: 'Replay',
    description: 'Historical replay and event review',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Operational controls and diagnostics',
  },
  {
    id: 'health',
    label: 'Health',
    description: 'Feed, parser, and connector health',
  },
];

export const getViewModeLabel = (viewId) => {
  return VIEW_MODES.find((mode) => mode.id === viewId)?.label || VIEW_MODES[0].label;
};
