import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearNewTransactionHighlight,
  scheduleNewTransactionHighlight,
} from './dashboardHighlight';

describe('dashboard transaction highlight scheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears a pending highlight timeout without resetting stale state', () => {
    vi.useFakeTimers();
    const timeoutRef = { current: null };
    const setNewTransactionId = vi.fn();

    scheduleNewTransactionHighlight('txn-1', setNewTransactionId, timeoutRef, 1000);
    clearNewTransactionHighlight(timeoutRef);
    vi.advanceTimersByTime(1000);

    expect(setNewTransactionId).toHaveBeenCalledTimes(1);
    expect(setNewTransactionId).toHaveBeenCalledWith('txn-1');
    expect(timeoutRef.current).toBeNull();
  });

  it('resets the active highlight after the delay', () => {
    vi.useFakeTimers();
    const timeoutRef = { current: null };
    const setNewTransactionId = vi.fn();

    scheduleNewTransactionHighlight('txn-2', setNewTransactionId, timeoutRef, 1000);
    vi.advanceTimersByTime(1000);

    expect(setNewTransactionId).toHaveBeenNthCalledWith(1, 'txn-2');
    expect(setNewTransactionId).toHaveBeenNthCalledWith(2, null);
    expect(timeoutRef.current).toBeNull();
  });
});
