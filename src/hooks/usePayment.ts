/**
 * Hook for retrying VNPay payments on unpaid orders.
 *
 * Calls POST /api/v1/payments/vnpay/create via paymentService.
 * On success, invalidates the authoritative order detail query
 * using `queryKeys.orders.detail(orderId)` so the order view stays fresh.
 *
 * Payment state is not queried independently; OrderResponse remains
 * the single authoritative source of truth.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { createVnpayPayment } from '../services/paymentService';
import type { VnpayPaymentResponse } from '../types/paymentApi';

export function useRetryPayment() {
  const queryClient = useQueryClient();

  return useMutation<VnpayPaymentResponse, Error, string>({
    mutationFn: (orderId: string) => createVnpayPayment(orderId),
    onSuccess: (_data, orderId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(orderId),
      });
    },
  });
}
