/**
 * TanStack Query hooks for platform vouchers.
 *
 * Provides `useValidateVoucher` mutation to validate voucher codes on-demand
 * when the customer presses "Apply" on the checkout screen.
 * Validation does not consume the voucher.
 */

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';

import { getUsableVouchers, validateVoucher } from '../services/voucherService';
import type { VoucherResponse } from '../types/voucherApi';

/** Usable vouchers, loaded page by page. The data is the same for everyone so it is not keyed by account. */
export function useUsableVouchers() {
  return useInfiniteQuery({
    queryKey: queryKeys.vouchers.usable(),
    queryFn: ({ pageParam }) => getUsableVouchers(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page + 1 >= lastPage.totalPages ? undefined : lastPage.page + 1,
    staleTime: 60_000,
  });
}

export function useValidateVoucher() {
  return useMutation<VoucherResponse, unknown, string>({
    mutationFn: (code: string) => validateVoucher(code),
    retry: false,
  });
}
