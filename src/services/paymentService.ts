/**
 * Payment API service - thin wrapper over backend VNPay payment endpoints.
 *
 * Uses the shared `apiClient` (inheriting base URL with /api/v1 prefix, Bearer auth header,
 * and 401 refresh behavior) and `unwrapData` helper to convert backend `ApiResponse<T>` envelope
 * into the payload or throw a typed `ApiError`.
 *
 * Contract verified against backend source:
 * - POST /api/v1/payments/vnpay/create -> 200 ApiResponse<VnpayPaymentResponse> (CUSTOMER only)
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { VnpayCreateRequest, VnpayPaymentResponse } from '../types/paymentApi';

/**
 * Creates a new VNPay payment attempt for an unpaid pending order.
 *
 * Used for repayment/retrying when an initial checkout payment failed, was abandoned,
 * or expired. Returns a fresh signed paymentUrl valid for 15 minutes.
 *
 * @param orderId UUID of the customer's pending VNPay order.
 */
export async function createVnpayPayment(orderId: string): Promise<VnpayPaymentResponse> {
  const request: VnpayCreateRequest = { orderId };
  const response = await apiClient.post<ApiResponse<VnpayPaymentResponse>>(
    '/payments/vnpay/create',
    request,
  );
  return unwrapData(response);
}
