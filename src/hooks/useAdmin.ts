/**
 * TanStack Query hooks for Admin Portal operations.
 *
 * Exposes:
 * - Phase 1:
 *   - useAdminSellers: paginated query for seller accounts with search filtering
 *   - useApproveSeller: mutation to approve pending or suspended sellers
 *   - useSuspendSeller: mutation to suspend approved sellers
 * - Phase 2:
 *   - useAdminUsers: paginated query for all users with role and search filtering
 *   - useAdminUserDetail: query for single user details by ID
 *   - useCreateAdminUser: mutation to create users with any role
 *   - useUpdateAdminUser: mutation to update user fields, role, or re-enable account
 *   - useDisableAdminUser: mutation to soft-disable account
 * - Phase 3:
 *   - useCreateAdminCategory: mutation to create new category and invalidate category queries
 *   - useUpdateAdminCategory: mutation to rename category and invalidate categories + products queries
 *   - useDeleteAdminCategory: mutation to delete category and invalidate category queries
 * - Phase 4:
 *   - useAdminVouchers: paginated query for platform vouchers
 *   - useCreateAdminVoucher: mutation to create platform voucher and invalidate admin + customer voucher queries
 *   - useUpdateAdminVoucher: mutation to update platform voucher and invalidate admin + customer voucher queries
 *   - useExpireAdminVoucher: mutation to expire platform voucher and invalidate admin + customer voucher queries
 * - Phase 5:
 *   - useAdminCarriers: query for all shipping carriers (active and inactive)
 *   - useCreateAdminCarrier: mutation to create carrier and invalidate admin + seller fulfillment carriers
 *   - useUpdateAdminCarrier: mutation to update/rename/toggle carrier and invalidate admin + seller fulfillment carriers
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import {
  approveSeller,
  createAdminCarrier,
  createAdminCategory,
  createAdminUser,
  createAdminVoucher,
  deleteAdminCategory,
  disableAdminUser,
  expireAdminVoucher,
  fetchAdminCarriers,
  fetchAdminSellers,
  fetchAdminUserById,
  fetchAdminUsers,
  fetchAdminVouchers,
  suspendSeller,
  updateAdminCarrier,
  updateAdminCategory,
  updateAdminUser,
  updateAdminVoucher,
} from '../services/adminService';
import type {
  AdminCarrierCreateRequest,
  AdminCarrierUpdateRequest,
  AdminCategoryCreateRequest,
  AdminCategoryUpdateRequest,
  AdminSellerListParams,
  AdminUser,
  AdminUserCreateRequest,
  AdminUserListParams,
  AdminUserPage,
  AdminUserUpdateRequest,
  AdminVoucherCreateRequest,
  AdminVoucherListParams,
  AdminVoucherPage,
  AdminVoucherUpdateRequest,
  Carrier,
} from '../types/adminApi';
import type { CategorySummaryDto } from '../types/productApi';
import type { VoucherResponse } from '../types/voucherApi';

/**
 * Queries the list of sellers for Admin Portal review (Phase 1).
 * Only executes when `enabled` is true (typically when authenticated user has Role.ADMIN).
 */
export function useAdminSellers(params: AdminSellerListParams = {}, enabled = true) {
  return useQuery<AdminUserPage>({
    queryKey: queryKeys.admin.sellers.list(params),
    queryFn: () => fetchAdminSellers(params),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Mutation to approve a seller account (Phase 1).
 * On success, automatically invalidates all admin seller and user queries to refetch authoritative data.
 */
export function useApproveSeller() {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, string>({
    mutationFn: (sellerId: string) => approveSeller(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sellers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

/**
 * Mutation to suspend an approved seller account (Phase 1).
 * On success, automatically invalidates all admin seller and user queries to refetch authoritative data.
 */
export function useSuspendSeller() {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, string>({
    mutationFn: (sellerId: string) => suspendSeller(sellerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sellers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

/**
 * Queries the list of users for Admin Portal management (Phase 2).
 * Supports role filtering and search keywords.
 */
export function useAdminUsers(params: AdminUserListParams = {}, enabled = true) {
  return useQuery<AdminUserPage>({
    queryKey: queryKeys.admin.users.list(params),
    queryFn: () => fetchAdminUsers(params),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Queries a single user's full details by ID (Phase 2).
 */
export function useAdminUserDetail(userId: string, enabled = true) {
  return useQuery<AdminUser>({
    queryKey: queryKeys.admin.users.detail(userId),
    queryFn: () => fetchAdminUserById(userId),
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/**
 * Mutation to create a new user (Phase 2).
 * On success, invalidates admin user list queries (and seller queries if role is SELLER).
 */
export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<AdminUser, Error, AdminUserCreateRequest>({
    mutationFn: (payload: AdminUserCreateRequest) => createAdminUser(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      if (data.role === 'SELLER') {
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.sellers.all });
      }
    },
  });
}

/**
 * Mutation to update an existing user (Phase 2).
 * Supports updating name, role, phone, address, sellerStatus, or re-enabling (`enabled: true`).
 * On success, invalidates user list, user detail, and seller list queries.
 */
export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUser,
    Error,
    { id: string; payload: AdminUserUpdateRequest }
  >({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUserUpdateRequest }) =>
      updateAdminUser(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sellers.all });
    },
  });
}

/**
 * Mutation to soft-disable a user account (Phase 2).
 * On success, invalidates user list, user detail, and seller list queries.
 */
export function useDisableAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (userId: string) => disableAdminUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.admin.users.detail(userId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.sellers.all });
    },
  });
}

/**
 * Mutation to create a category (Phase 3).
 * On success, invalidates all category queries across the app.
 */
export function useCreateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategorySummaryDto, Error, AdminCategoryCreateRequest>({
    mutationFn: (payload: AdminCategoryCreateRequest) => createAdminCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

/**
 * Mutation to rename an existing category (Phase 3).
 * On success, invalidates categories and catalog/seller products since product summaries embed category name.
 */
export function useUpdateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<
    CategorySummaryDto,
    Error,
    { id: string; payload: AdminCategoryUpdateRequest }
  >({
    mutationFn: ({ id, payload }: { id: string; payload: AdminCategoryUpdateRequest }) =>
      updateAdminCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerProducts.all });
    },
  });
}

/**
 * Mutation to delete a category (Phase 3).
 * On success, invalidates all category queries across the app.
 */
export function useDeleteAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => deleteAdminCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

/**
 * Queries the paginated list of platform vouchers for Admin review (Phase 4).
 * Only executes when `enabled` is true (ADMIN only).
 */
export function useAdminVouchers(params: AdminVoucherListParams = {}, enabled = true) {
  return useQuery<AdminVoucherPage>({
    queryKey: queryKeys.admin.vouchers.list(params),
    queryFn: () => fetchAdminVouchers(params),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Mutation to create a new platform voucher (Phase 4).
 * On success, invalidates admin voucher list queries and customer voucher validation cache.
 */
export function useCreateAdminVoucher() {
  const queryClient = useQueryClient();

  return useMutation<VoucherResponse, Error, AdminVoucherCreateRequest>({
    mutationFn: (payload: AdminVoucherCreateRequest) => createAdminVoucher(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.vouchers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vouchers.all });
    },
  });
}

/**
 * Mutation to update an existing platform voucher (Phase 4).
 * On success, invalidates admin voucher list queries and customer voucher validation cache.
 */
export function useUpdateAdminVoucher() {
  const queryClient = useQueryClient();

  return useMutation<
    VoucherResponse,
    Error,
    { code: string; payload: AdminVoucherUpdateRequest }
  >({
    mutationFn: ({ code, payload }: { code: string; payload: AdminVoucherUpdateRequest }) =>
      updateAdminVoucher(code, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.vouchers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vouchers.all });
    },
  });
}

/**
 * Mutation to expire a platform voucher immediately (Phase 4).
 * On success, invalidates admin voucher list queries and customer voucher validation cache.
 */
export function useExpireAdminVoucher() {
  const queryClient = useQueryClient();

  return useMutation<VoucherResponse, Error, string>({
    mutationFn: (code: string) => expireAdminVoucher(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.vouchers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vouchers.all });
    },
  });
}

/** Alias for useExpireAdminVoucher to match semantic delete requirements. */
export const useDeleteAdminVoucher = useExpireAdminVoucher;

// ============================================================================
// Carrier Management Hooks (Phase 5)
// ============================================================================

/**
 * Queries the complete list of shipping carriers (active and inactive) for Admin (Phase 5).
 * Only executes when `enabled` is true (typically when authenticated user has Role.ADMIN).
 */
export function useAdminCarriers(enabled = true) {
  return useQuery<Carrier[]>({
    queryKey: queryKeys.admin.carriers.list(),
    queryFn: () => fetchAdminCarriers(),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Mutation to create a new shipping carrier (Phase 5).
 * On success, invalidates both the admin carriers list and the seller fulfillment carriers list
 * so sellers immediately see newly added active carriers.
 */
export function useCreateAdminCarrier() {
  const queryClient = useQueryClient();

  return useMutation<Carrier, Error, AdminCarrierCreateRequest>({
    mutationFn: (payload: AdminCarrierCreateRequest) => createAdminCarrier(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.carriers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerFulfillment.carriers.all });
    },
  });
}

/**
 * Mutation to update/rename/toggle a shipping carrier (Phase 5).
 * On success, invalidates both the admin carriers list and the seller fulfillment carriers list
 * so any rename or deactivation is reflected immediately in seller shipment creation flows.
 */
export function useUpdateAdminCarrier() {
  const queryClient = useQueryClient();

  return useMutation<
    Carrier,
    Error,
    { id: string; payload: AdminCarrierUpdateRequest }
  >({
    mutationFn: ({ id, payload }: { id: string; payload: AdminCarrierUpdateRequest }) =>
      updateAdminCarrier(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.carriers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerFulfillment.carriers.all });
    },
  });
}



