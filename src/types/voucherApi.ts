/**
 * Backend DTO types for platform voucher validation.
 *
 * Contract verified against backend VoucherResponse.java:
 * - GET /api/v1/vouchers/{code}/validate -> 200 ApiResponse<VoucherResponse>
 * - GET /api/v1/vouchers -> 200 ApiResponse<PageResponse<VoucherSummaryResponse>>
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

/** Publicly shown voucher (VoucherSummaryResponse): has no usage count. */
export interface VoucherSummary {
  code: string;
  description: string;
  discountPercent: number;
  validTo: string;
}

/** A page of usable vouchers, `page` starts from 0. */
export interface VoucherSummaryPage {
  content: VoucherSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
