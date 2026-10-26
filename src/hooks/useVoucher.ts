/**
 * TanStack Query hooks for platform vouchers.
 *
 * Provides `useValidateVoucher` mutation to validate voucher codes on-demand
 * when the customer presses "Apply" on the checkout screen.
 * Validation does not consume the voucher.
 */

import { useMutation } from '@tanstack/react-query';

import { validateVoucher } from '../services/voucherService';
import type { VoucherResponse } from '../types/voucherApi';

export function useValidateVoucher() {
  return useMutation<VoucherResponse, unknown, string>({
    mutationFn: (code: string) => validateVoucher(code),
    retry: false,
  });
}
