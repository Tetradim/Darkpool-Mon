import { describe, expect, it } from 'vitest';

import { WORKSPACE_VIEW_COMPONENTS, getWorkspaceViewComponent } from './lazyViews';

describe('lazy view registry', () => {
  it('maps every non-dashboard workspace to a lazy component', () => {
    const expectedViewModes = [
      'admin',
      'alerts',
      'flowmap',
      'health',
      'intent',
      'options',
      'replay',
      'scanner',
      'watchlist',
    ];

    expect(Object.keys(WORKSPACE_VIEW_COMPONENTS).sort()).toEqual(expectedViewModes);
    expectedViewModes.forEach((viewMode) => {
      expect(getWorkspaceViewComponent(viewMode)).toBe(WORKSPACE_VIEW_COMPONENTS[viewMode]);
    });
  });

  it('returns null for dashboard and unknown views', () => {
    expect(getWorkspaceViewComponent('dashboard')).toBeNull();
    expect(getWorkspaceViewComponent('unknown')).toBeNull();
    expect(getWorkspaceViewComponent()).toBeNull();
  });
});
