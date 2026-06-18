const getErrorDetail = (error) => {
  if (error?.status) return `Request failed with HTTP ${error.status}.`;
  if (error?.message) return error.message;
  return 'Request failed.';
};

export const buildRequestFailure = (label, error) => ({
  title: `${label} unavailable`,
  detail: getErrorDetail(error),
  tone: 'error',
});

export const summarizeRequestStatus = ({ label, loading, error, itemCount = 0 } = {}) => {
  if (loading || !error) return null;

  if (itemCount > 0) {
    return {
      title: `${label} data may be stale`,
      detail: `Showing ${itemCount} previously loaded records. ${error.detail}`,
      tone: 'warning',
    };
  }

  return error;
};
