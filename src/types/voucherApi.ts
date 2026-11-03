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

/** Voucher hiển thị công khai (VoucherSummaryResponse): không có số lượt dùng. */
export interface VoucherSummary {
  code: string;
  description: string;
  discountPercent: number;
  validTo: string;
}

/** Một trang voucher đang dùng được, `page` bắt đầu từ 0. */
export interface VoucherSummaryPage {
  content: VoucherSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
