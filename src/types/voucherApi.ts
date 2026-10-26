/**
 * Backend DTO types for platform voucher validation.
 *
 * Contract verified against backend VoucherResponse.java:
 * - GET /api/v1/vouchers/{code}/validate -> 200 ApiResponse<VoucherResponse>
 */

export interface VoucherResponse {
  code: string;
  description: string;
  discountPercent: number;
  validFrom: string;
  validTo: string;
  usageLimit: number;
  timesUsed: number;
}
