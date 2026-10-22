/**
 * TanStack Query hook for the current authenticated user.
 * Uses GET /api/v1/users/me via authService.getCurrentUser().
 * Only intended for authenticated users; callers should gate on auth state.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { getCurrentUser } from '../services/authService';
import type { User } from '../types/auth';

export function useCurrentUser(enabled = true) {
  return useQuery<User>({
    queryKey: queryKeys.user.me(),
    queryFn: getCurrentUser,
    enabled,
    // Keep profile reasonably fresh but don't refetch excessively
    staleTime: 2 * 60 * 1000,
  });
}
