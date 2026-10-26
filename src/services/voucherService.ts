/**
 * Voucher API service - thin wrapper over backend customer voucher endpoints.
 *
 * Uses the shared `apiClient` (inheriting base URL, Bearer auth header, and 401 refresh)
 * and `unwrapData` helper to convert backend `ApiResponse` envelope into payload or throw typed `ApiError`.
 *
 * Contract verified against backend source:
 * - GET /api/v1/vouchers/{code}/validate -> 200 ApiResponse<VoucherResponse> (CUSTOMER only)
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { VoucherResponse } from '../types/voucherApi';

/**
 * Validates a platform voucher code before checkout.
 *
 * Does not consume the voucher; consumption occurs atomically during checkout.
 * Code is trimmed before making the request; backend handles case-insensitivity authoritatively.
 */
export async function validateVoucher(code: string): Promise<VoucherResponse> {
  const trimmed = code.trim();
  const response = await apiClient.get<ApiResponse<VoucherResponse>>(
    `/vouchers/${encodeURIComponent(trimmed)}/validate`,
  );
  return unwrapData(response);
}
