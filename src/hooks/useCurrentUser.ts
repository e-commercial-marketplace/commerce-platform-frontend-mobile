/**
 * TanStack Query hook for the current authenticated user.
 * Uses GET /api/v1/users/me via authService.getCurrentUser().
 * Only intended for authenticated users; callers should gate on auth state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { getCurrentUser, updateProfile } from '../services/authService';
import type { UpdateProfileRequest, UserProfile } from '../types/auth';

export function useCurrentUser(enabled = true) {
  return useQuery<UserProfile>({
    queryKey: queryKeys.user.me(),
    queryFn: getCurrentUser,
    enabled,
    // Keep profile reasonably fresh but don't refetch excessively
    staleTime: 2 * 60 * 1000,
  });
}

/** Sửa hồ sơ: lưu response vào cache để màn Profile hiện ngay giá trị mới, không tự thử lại. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<UserProfile, Error, UpdateProfileRequest>({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.user.me(), updated);
    },
  });
}
