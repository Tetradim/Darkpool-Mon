import { lazy } from 'react';

const lazyNamed = (loader, exportName) => lazy(() => (
  loader().then((module) => ({ default: module[exportName] }))
));

export const SettingsModal = lazy(() => import('./SettingsModal'));
export const StockSparkline = lazyNamed(() => import('./DashboardCharts'), 'StockSparkline');
export const TransactionVolumeChart = lazyNamed(() => import('./DashboardCharts'), 'TransactionVolumeChart');

export const WORKSPACE_VIEW_COMPONENTS = {
  options: lazy(() => import('./OptionsDashboard')),
  intent: lazyNamed(() => import('./TradeIntentView'), 'TradeIntentView'),
  scanner: lazyNamed(() => import('./ProductionViews'), 'ScannerView'),
  alerts: lazyNamed(() => import('./ProductionViews'), 'AlertsView'),
  watchlist: lazyNamed(() => import('./ProductionViews'), 'WatchlistView'),
  health: lazyNamed(() => import('./ProductionViews'), 'HealthView'),
  flowmap: lazyNamed(() => import('./AdvancedViews'), 'FlowMapView'),
  replay: lazyNamed(() => import('./AdvancedViews'), 'ReplayView'),
  admin: lazyNamed(() => import('./AdvancedViews'), 'AdminView'),
};

export const getWorkspaceViewComponent = (viewMode) => WORKSPACE_VIEW_COMPONENTS[viewMode] || null;
