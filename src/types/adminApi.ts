/**
 * Type contracts for Admin Portal APIs.
 *
 * Sourced strictly from backend DTOs:
 * - com.marketplace.dto.request.AdminUserCreateRequest
 * - com.marketplace.dto.request.AdminUserUpdateRequest
 * - com.marketplace.dto.response.UserResponse
 * - com.marketplace.common.response.PageResponse
 * - com.marketplace.enums.Role
 * - com.marketplace.enums.SellerStatus
 */

import type { Role } from './auth';

export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** Full user response payload returned by admin endpoints. */
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: Role;
  sellerStatus: SellerStatus | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Paginated response matching backend PageResponse<UserResponse>. */
export type AdminUserPage = {
  content: AdminUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** Query parameters accepted by GET /api/v1/admin/users when filtering sellers (Phase 1). */
export type AdminSellerListParams = {
  search?: string;
  page?: number;
  size?: number;
};

/** Query parameters accepted by GET /api/v1/admin/users for full user management (Phase 2). */
export type AdminUserListParams = {
  role?: Role;
  search?: string;
  page?: number;
  size?: number;
};

/**
 * Request payload for POST /api/v1/admin/users.
 * Admin can create accounts for any role.
 * - Password: 8..72 characters (BCrypt max 72 bytes).
 * - Enabled: optional boolean (defaults to true on backend).
 * - Phone: optional Vietnamese mobile number.
 * - Address: optional, max 500 characters.
 */
export type AdminUserCreateRequest = {
  email: string;
  password: string;
  name: string;
  role: Role;
  enabled?: boolean;
  phone?: string;
  address?: string;
};

/**
 * Request payload for PATCH /api/v1/admin/users/{id}.
 * Fields that are undefined are omitted from payload (backend leaves them unchanged).
 * - Phone: optional Vietnamese phone or empty string "" to clear.
 * - Address: optional string (max 500) or empty string "" to clear.
 * - SellerStatus: ONLY valid when role is SELLER; otherwise backend returns 400.
 */
export type AdminUserUpdateRequest = {
  name?: string;
  role?: Role;
  sellerStatus?: SellerStatus;
  enabled?: boolean;
  phone?: string;
  address?: string;
};

/**
 * Request payload for POST /api/v1/admin/categories (Phase 3).
 * - Name: required, not blank, max 120 characters.
 */
export type AdminCategoryCreateRequest = {
  name: string;
};

/**
 * Request payload for PATCH /api/v1/admin/categories/{id} (Phase 3).
 * - Name: required, not blank, max 120 characters.
 */
export type AdminCategoryUpdateRequest = {
  name: string;
};

/**
 * Query parameters accepted by GET /api/v1/admin/vouchers (Phase 4).
 */
export type AdminVoucherListParams = {
  page?: number;
  size?: number;
};

/**
 * Paginated response matching backend PageResponse<VoucherResponse> (Phase 4).
 */
export type AdminVoucherPage = {
  content: import('./voucherApi').VoucherResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * Request payload for POST /api/v1/admin/vouchers (Phase 4).
 * - code: 1..64 chars, regex [A-Za-z0-9_-], normalized to uppercase.
 * - description: optional, max 1000 chars.
 * - discountPercent: 1..100.
 * - validFrom: ISO-8601 Instant string.
 * - validTo: ISO-8601 Instant string (must be > validFrom).
 * - usageLimit: integer >= 1.
 */
export type AdminVoucherCreateRequest = {
  code: string;
  description?: string | null;
  discountPercent: number;
  validFrom: string;
  validTo: string;
  usageLimit: number;
};

/**
 * Request payload for PATCH /api/v1/admin/vouchers/{code} (Phase 4).
 * - code is immutable (in path).
 * - discountPercent: can ONLY change if timesUsed == 0.
 * - validFrom / validTo: must maintain validFrom < validTo.
 * - usageLimit: must be >= timesUsed.
 */
export type AdminVoucherUpdateRequest = {
  description?: string | null;
  discountPercent?: number;
  validFrom?: string;
  validTo?: string;
  usageLimit?: number;
};

// ============================================================================
// Shipping Carrier Management Types (Phase 5)
// Sourced from:
// - com.marketplace.dto.request.CarrierCreateRequest
// - com.marketplace.dto.request.CarrierUpdateRequest
// - com.marketplace.dto.response.CarrierResponse
// ============================================================================

export type { Carrier, CarrierResponse } from './sellerApi';

/**
 * Request payload for POST /api/v1/admin/carriers (Phase 5).
 * - name: 1..100 characters, trimmed.
 */
export type AdminCarrierCreateRequest = {
  name: string;
};

/**
 * Request payload for PATCH /api/v1/admin/carriers/{id} (Phase 5).
 * - name: optional, 1..100 characters if provided.
 * - active: optional boolean, toggles carrier availability for sellers.
 *
 * NOTE: Deletion is deliberately not supported by the backend design
 * (shipments have foreign keys referencing carriers with ON DELETE RESTRICT).
 * Carriers are deactivated by setting active = false.
 */
export type AdminCarrierUpdateRequest = {
  name?: string;
  active?: boolean;
};



