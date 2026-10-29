/**
 * Unit tests for the useRetryPayment hook.
 *
 * Verifies:
 * 1. mutation calls createVnpayPayment with exact orderId
 * 2. success returns VnpayPaymentResponse
 * 3. correct order detail query invalidated via queryKeys.orders.detail(orderId)
 * 4. service error propagates
 * 5. no unrelated cache invalidation
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { createVnpayPayment } from '../../services/paymentService';
import type { VnpayPaymentResponse } from '../../types/paymentApi';
import { useRetryPayment } from '../usePayment';

jest.mock('../../services/paymentService', () => ({
  createVnpayPayment: jest.fn(),
}));

const mockedCreateVnpayPayment = createVnpayPayment as jest.MockedFunction<
  typeof createVnpayPayment
>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mockResponse: VnpayPaymentResponse = {
  paymentId: 'payment-1',
  orderId: 'order-1',
  amount: '2990000.00',
  status: 'PENDING',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=1',
};

describe('useRetryPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls createVnpayPayment with exact orderId and returns response data', async () => {
    mockedCreateVnpayPayment.mockResolvedValue(mockResponse);

    const client = makeClient();
    const { result } = renderHook(() => useRetryPayment(), {
      wrapper: wrapper(client),
    });

    const data = await result.current.mutateAsync('order-1');

    expect(mockedCreateVnpayPayment).toHaveBeenCalledTimes(1);
    expect(mockedCreateVnpayPayment).toHaveBeenCalledWith('order-1');
    expect(data).toEqual(mockResponse);
  });

  it('invalidates only the target order detail query upon success', async () => {
    mockedCreateVnpayPayment.mockResolvedValue(mockResponse);

    const client = makeClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRetryPayment(), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync('order-1');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.orders.detail('order-1'),
      });
    });

    // Verify it did not invalidate other orders or cart
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.orders.detail('order-2'),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.cart.all,
    });
  });

  it('propagates service ApiError on failure without query invalidation', async () => {
    const error = new ApiError(
      'The order cannot be paid with VNPAY',
      'ORDER_NOT_PAYABLE',
      409,
    );
    mockedCreateVnpayPayment.mockRejectedValue(error);

    const client = makeClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRetryPayment(), {
      wrapper: wrapper(client),
    });

    await expect(result.current.mutateAsync('order-1')).rejects.toBe(error);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
