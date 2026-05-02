import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 10000, // 10s cache
			gcTime: 5 * 60 * 1000, // 5min garbage collection
		},
	},
});