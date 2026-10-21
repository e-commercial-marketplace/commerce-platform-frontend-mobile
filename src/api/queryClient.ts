/**
 * Central TanStack Query configuration (server-state layer).
 *
 * Architecture (docs/03 §"Mobile server state", docs/02 §8.1 and the frontend
 * README): the shared Axios client owns HTTP/headers/Bearer/error handling,
 * TanStack Query owns cache, loading, refetch, retry and invalidation, and
 * feature API modules own endpoint paths and payload mapping.
 *
 * This module exposes exactly one QueryClient for the whole app. Creating it
 * once (module scope) keeps the cache stable across renders and provider
 * re-mounts, which is required for the invalidation conventions below to work.
 *
 * Deliberately NOT configured here (out of scope for this foundation):
 * - offline/persisted cache (no AsyncStorage/SecureStore persistence);
 * - global error toasts or global auth handling (AuthContext stays as-is);
 * - any concrete query or mutation (features add those, not this file).
 */

import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './errors';

/**
 * Server data on mobile must stay fresh but must also survive normal
 * navigation. Five minutes of `staleTime` means moving between Home, Product
 * Detail and back does not refetch, while a new screen visit after a while
 * still revalidates.
 */
const STALE_TIME_MS = 5 * 60 * 1000;

/** Upper bound for how long unused data is kept before garbage collection. */
const GC_TIME_MS = 30 * 60 * 1000;

/** Default retry budget for transient failures (Render cold starts). */
const DEFAULT_RETRY_COUNT = 2;

/**
 * A backend response the server actually produced is authoritative: retrying a
 * 400/401/403/404/409 only delays the error the user must see. Network and
 * timeout failures (no HTTP response) are worth retrying, and the shared Axios
 * client already rotates the access token on a single 401 before this runs.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status != null && error.status < 500) {
    return false;
  }
  return failureCount < DEFAULT_RETRY_COUNT;
}

/**
 * Single app-wide QueryClient.
 *
 * `refetchOnWindowFocus` is disabled because React Native has no browser focus
 * event that maps meaningfully onto it; `refetchOnReconnect` is kept on so a
 * device that regains connectivity refreshes stale server data.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      // Mutations are user-initiated: a failed write must surface immediately
      // instead of silently repeating (e.g. a double "Add to Cart").
      retry: false,
    },
  },
});
