/**
 * Unit tests for voucher TanStack Query hooks.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { validateVoucher } from '../../services/voucherService';
import type { VoucherResponse } from '../../types/voucherApi';
import { useValidateVoucher } from '../useVoucher';

jest.mock('../../services/voucherService', () => ({
  validateVoucher: jest.fn(),
}));

const mockedValidateVoucher = validateVoucher as jest.MockedFunction<typeof validateVoucher>;

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

const mockVoucher: VoucherResponse = {
  code: 'WELCOME10',
  description: 'Giảm 10% cho đơn đầu tiên',
  discountPercent: 10,
  validFrom: '2026-10-24T00:00:00Z',
  validTo: '2027-01-23T00:00:00Z',
  usageLimit: 1000,
  timesUsed: 0,
};

describe('useVoucher hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useValidateVoucher', () => {
    it('invokes validateVoucher service and returns VoucherResponse on success', async () => {
      const client = makeClient();
      mockedValidateVoucher.mockResolvedValueOnce(mockVoucher);

      const { result } = renderHook(() => useValidateVoucher(), {
        wrapper: wrapper(client),
      });

      let res: VoucherResponse | undefined;
      await act(async () => {
        res = await result.current.mutateAsync('WELCOME10');
      });

      expect(mockedValidateVoucher).toHaveBeenCalledWith('WELCOME10');
      expect(res).toEqual(mockVoucher);
      expect(result.current.isSuccess).toBe(true);
    });

    it('tracks isPending state while validation request is in flight', async () => {
      const client = makeClient();
      let resolvePromise!: (v: VoucherResponse) => void;
      mockedValidateVoucher.mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() => useValidateVoucher(), {
        wrapper: wrapper(client),
      });

      let mutatePromise: Promise<VoucherResponse>;
      act(() => {
        mutatePromise = result.current.mutateAsync('WELCOME10');
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      await act(async () => {
        resolvePromise(mockVoucher);
        await mutatePromise;
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.isSuccess).toBe(true);
    });

    it('propagates errors when validation fails', async () => {
      const client = makeClient();
      const mockError = new Error('Voucher expired');
      mockedValidateVoucher.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useValidateVoucher(), {
        wrapper: wrapper(client),
      });

      await act(async () => {
        await expect(result.current.mutateAsync('EXPIRED30')).rejects.toThrow('Voucher expired');
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBe(mockError);
    });
  });
});
