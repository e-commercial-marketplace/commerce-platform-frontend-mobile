/**
 * Admin API service — thin wrapper around backend administrative endpoints.
 *
 * Uses the shared `apiClient` (inheriting base URL, Bearer authentication header,
 * and 401 refresh rotation) and `unwrapData` to unbox the backend `ApiResponse` envelope.
 *
 * Endpoints implemented:
 * - GET /admin/users (filtered by role or all users)
 * - GET /admin/users/{id}
 * - POST /admin/users
 * - PATCH /admin/users/{id}
 * - DELETE /admin/users/{id} (soft-disable account)
 * - PATCH /admin/sellers/{id}/approve
 * - PATCH /admin/sellers/{id}/suspend
 * - POST /admin/categories
 * - PATCH /admin/categories/{id}
 * - DELETE /admin/categories/{id}
 * - GET /admin/vouchers
 * - POST /admin/vouchers
 * - PATCH /admin/vouchers/{code}
 * - DELETE /admin/vouchers/{code} (expire voucher)
 * - GET /admin/carriers (Phase 5)
 * - POST /admin/carriers (Phase 5)
 * - PATCH /admin/carriers/{id} (Phase 5)
 * (No DELETE carrier: deactivated via active=false)
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
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
 * Fetches a paginated list of sellers from GET /admin/users.
 * Forces role=SELLER to scope specifically to seller accounts (Phase 1).
 */
export async function fetchAdminSellers(
  params: AdminSellerListParams = {},
): Promise<AdminUserPage> {
  const queryParams: Record<string, string | number> = {
    role: 'SELLER',
    page: params.page ?? 0,
    size: params.size ?? 20,
  };

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    queryParams.search = trimmedSearch;
  }

  const response = await apiClient.get<ApiResponse<AdminUserPage>>('/admin/users', {
    params: queryParams,
  });

  return unwrapData(response);
}

/**
 * Fetches a paginated list of users from GET /admin/users with optional role and search filters (Phase 2).
 */
export async function fetchAdminUsers(
  params: AdminUserListParams = {},
): Promise<AdminUserPage> {
  const queryParams: Record<string, string | number> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  };

  if (params.role) {
    queryParams.role = params.role;
  }

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    queryParams.search = trimmedSearch;
  }

  const response = await apiClient.get<ApiResponse<AdminUserPage>>('/admin/users', {
    params: queryParams,
  });

  return unwrapData(response);
}

/**
 * Fetches a single user by ID via GET /admin/users/{id}.
 */
export async function fetchAdminUserById(id: string): Promise<AdminUser> {
  const response = await apiClient.get<ApiResponse<AdminUser>>(`/admin/users/${id}`);
  return unwrapData(response);
}

/**
 * Creates a new user with any role via POST /admin/users.
 * Returns 201 Created with the newly created AdminUser.
 */
export async function createAdminUser(
  payload: AdminUserCreateRequest,
): Promise<AdminUser> {
  const response = await apiClient.post<ApiResponse<AdminUser>>('/admin/users', payload);
  return unwrapData(response);
}

/**
 * Updates an existing user via PATCH /admin/users/{id}.
 * Fields omitted/undefined in payload are left unchanged by the backend.
 */
export async function updateAdminUser(
  id: string,
  payload: AdminUserUpdateRequest,
): Promise<AdminUser> {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/users/${id}`,
    payload,
  );
  return unwrapData(response);
}

/**
 * Soft-disables a user account via DELETE /admin/users/{id}.
 * Returns 204 No Content.
 */
export async function disableAdminUser(id: string): Promise<void> {
  await apiClient.delete<void>(`/admin/users/${id}`);
}

/**
 * Approves a pending or suspended seller via PATCH /admin/sellers/{id}/approve.
 * Transitions seller status to APPROVED.
 */
export async function approveSeller(sellerId: string): Promise<AdminUser> {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/sellers/${sellerId}/approve`,
  );
  return unwrapData(response);
}

/**
 * Suspends an approved seller via PATCH /admin/sellers/{id}/suspend.
 * Transitions seller status to SUSPENDED.
 */
export async function suspendSeller(sellerId: string): Promise<AdminUser> {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/sellers/${sellerId}/suspend`,
  );
  return unwrapData(response);
}

/**
 * Creates a new category via POST /admin/categories (Phase 3).
 * Returns 201 Created with the newly created CategorySummaryDto.
 */
export async function createAdminCategory(
  payload: AdminCategoryCreateRequest,
): Promise<CategorySummaryDto> {
  const response = await apiClient.post<ApiResponse<CategorySummaryDto>>(
    '/admin/categories',
    { name: payload.name.trim() },
  );
  return unwrapData(response);
}

/**
 * Renames an existing category via PATCH /admin/categories/{id} (Phase 3).
 * Returns 200 OK with the updated CategorySummaryDto.
 */
export async function updateAdminCategory(
  id: string,
  payload: AdminCategoryUpdateRequest,
): Promise<CategorySummaryDto> {
  const response = await apiClient.patch<ApiResponse<CategorySummaryDto>>(
    `/admin/categories/${id}`,
    { name: payload.name.trim() },
  );
  return unwrapData(response);
}

/**
 * Deletes a category via DELETE /admin/categories/{id} (Phase 3).
 * Returns 204 No Content.
 * Throws error if category still has products.
 */
export async function deleteAdminCategory(id: string): Promise<void> {
  await apiClient.delete<void>(`/admin/categories/${id}`);
}

/**
 * Fetches a paginated list of platform vouchers via GET /admin/vouchers (Phase 4).
 * Returns PageResponse<VoucherResponse>.
 */
export async function fetchAdminVouchers(
  params: AdminVoucherListParams = {},
): Promise<AdminVoucherPage> {
  const queryParams: Record<string, number> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  };

  const response = await apiClient.get<ApiResponse<AdminVoucherPage>>('/admin/vouchers', {
    params: queryParams,
  });

  return unwrapData(response);
}

/**
 * Creates a new platform voucher via POST /admin/vouchers (Phase 4).
 * Normalizes code to uppercase; returns 201 Created with VoucherResponse.
 */
export async function createAdminVoucher(
  payload: AdminVoucherCreateRequest,
): Promise<VoucherResponse> {
  const body = {
    code: payload.code.trim().toUpperCase(),
    description: payload.description ? payload.description.trim() : null,
    discountPercent: payload.discountPercent,
    validFrom: payload.validFrom,
    validTo: payload.validTo,
    usageLimit: payload.usageLimit,
  };

  const response = await apiClient.post<ApiResponse<VoucherResponse>>(
    '/admin/vouchers',
    body,
  );
  return unwrapData(response);
}

/**
 * Updates an existing platform voucher via PATCH /admin/vouchers/{code} (Phase 4).
 * Code is immutable (in path). Null/omitted fields are left unchanged by the backend.
 * Returns 200 OK with updated VoucherResponse.
 */
export async function updateAdminVoucher(
  code: string,
  payload: AdminVoucherUpdateRequest,
): Promise<VoucherResponse> {
  const normalizedCode = code.trim().toUpperCase();
  const body: Record<string, unknown> = {};

  if (payload.description !== undefined) {
    body.description = payload.description ? payload.description.trim() : null;
  }
  if (payload.discountPercent !== undefined) {
    body.discountPercent = payload.discountPercent;
  }
  if (payload.validFrom !== undefined) {
    body.validFrom = payload.validFrom;
  }
  if (payload.validTo !== undefined) {
    body.validTo = payload.validTo;
  }
  if (payload.usageLimit !== undefined) {
    body.usageLimit = payload.usageLimit;
  }

  const response = await apiClient.patch<ApiResponse<VoucherResponse>>(
    `/admin/vouchers/${encodeURIComponent(normalizedCode)}`,
    body,
  );
  return unwrapData(response);
}

/**
 * Expires an existing platform voucher immediately via DELETE /admin/vouchers/{code} (Phase 4).
 * Backend sets validTo = now to preserve audit trail (does not hard-delete).
 * Returns 200 OK with the expired VoucherResponse.
 */
export async function expireAdminVoucher(code: string): Promise<VoucherResponse> {
  const normalizedCode = code.trim().toUpperCase();
  const response = await apiClient.delete<ApiResponse<VoucherResponse>>(
    `/admin/vouchers/${encodeURIComponent(normalizedCode)}`,
  );
  return unwrapData(response);
}

// ============================================================================
// Carrier Management Functions (Phase 5)
// Backend: com.marketplace.controller.AdminCarrierController
// ============================================================================

/**
 * Fetches all platform shipping carriers from GET /admin/carriers (Phase 5).
 * Unlike seller endpoint (/seller/carriers), this returns ALL carriers including deactivated ones.
 * Returns 200 OK with List<CarrierResponse> (sorted by name ASC).
 */
export async function fetchAdminCarriers(): Promise<Carrier[]> {
  const response = await apiClient.get<ApiResponse<Carrier[]>>('/admin/carriers');
  return unwrapData(response);
}

/**
 * Creates a new shipping carrier via POST /admin/carriers (Phase 5).
 * Backend defaults `active = true`. Carrier name must be unique (case-insensitive, max 100 chars).
 * Returns 201 Created with CarrierResponse.
 */
export async function createAdminCarrier(
  payload: AdminCarrierCreateRequest,
): Promise<Carrier> {
  const response = await apiClient.post<ApiResponse<Carrier>>('/admin/carriers', {
    name: payload.name.trim(),
  });
  return unwrapData(response);
}

/**
 * Updates an existing shipping carrier via PATCH /admin/carriers/{id} (Phase 5).
 * Supports renaming and/or toggling active state. Omitted/undefined fields are preserved by backend.
 * NOTE: Carrier deletion is intentionally not supported in the backend (shipments ON DELETE RESTRICT).
 * To remove from seller selection, pass { active: false }.
 * Returns 200 OK with CarrierResponse.
 */
export async function updateAdminCarrier(
  id: string,
  payload: AdminCarrierUpdateRequest,
): Promise<Carrier> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    body.name = payload.name.trim();
  }
  if (payload.active !== undefined) {
    body.active = payload.active;
  }

  const response = await apiClient.patch<ApiResponse<Carrier>>(
    `/admin/carriers/${encodeURIComponent(id)}`,
    body,
  );
  return unwrapData(response);
}



