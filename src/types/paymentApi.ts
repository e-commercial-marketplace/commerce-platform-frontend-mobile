/**
 * Backend DTO types for VNPay payment endpoints.
 *
 * Contract verified against backend source:
 * - com.marketplace.dto.request.VnpayCreateRequest
 * - com.marketplace.dto.response.VnpayPaymentResponse
 * - com.marketplace.enums.PaymentStatus
 *
 * Wire convention:
 * - POST /api/v1/payments/vnpay/create -> ApiResponse<VnpayPaymentResponse>
 * - Money amount is formatted as decimal string (VND, e.g. "2990000.00"), never JSON number.
 */

import type { PaymentStatus } from './orderApi';

export type { PaymentStatus };

/** Request body for POST /api/v1/payments/vnpay/create. */
export type VnpayCreateRequest = {
  /** Target order UUID owned by the caller. */
  orderId: string;
};

/** Response body data for POST /api/v1/payments/vnpay/create. */
export type VnpayPaymentResponse = {
  /** Payment attempt UUID. */
  paymentId: string;
  /** Associated order UUID. */
  orderId: string;
  /** Attempt amount as a VND decimal string. */
  amount: string;
  /** Status of this payment attempt (always PENDING when created). */
  status: PaymentStatus;
  /** Signed VNPay payment URL to be opened in browser. */
  paymentUrl: string;
};
