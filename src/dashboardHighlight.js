export const clearNewTransactionHighlight = (timeoutRef) => {
  if (timeoutRef.current === null) return;

  clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
};

export const scheduleNewTransactionHighlight = (
  transactionId,
  setNewTransactionId,
  timeoutRef,
  delayMs = 1000
) => {
  clearNewTransactionHighlight(timeoutRef);
  setNewTransactionId(transactionId);

  timeoutRef.current = setTimeout(() => {
    setNewTransactionId(null);
    timeoutRef.current = null;
  }, delayMs);

  return timeoutRef.current;
};
