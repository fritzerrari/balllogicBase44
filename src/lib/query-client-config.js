// Enhanced Query Client with timeout + retry
export const queryClientConfig = {
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000, // 30s
      gcTime: 5 * 60 * 1000, // 5m cache
      throwOnError: false, // Don't crash on API error
    },
    mutations: {
      retry: 1,
      throwOnError: false,
    },
  },
};