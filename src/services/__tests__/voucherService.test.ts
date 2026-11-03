/**
 * Unit tests for voucher API service.
 */

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { VoucherResponse } from '../../types/voucherApi';
import { getUsableVouchers, validateVoucher } from '../voucherService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const mockVoucher: VoucherResponse = {
  code: 'WELCOME10',
  description: 'Giảm 10% cho đơn đầu tiên',
  discountPercent: 10,
  validFrom: '2026-10-24T00:00:00Z',
  validTo: '2027-01-23T00:00:00Z',
  usageLimit: 1000,
  timesUsed: 0,
};

describe('voucherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsableVouchers', () => {
    it('calls GET /vouchers with the page parameters and unwraps data', async () => {
      const page = { content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 };
      mockedClient.get.mockResolvedValueOnce({ data: { success: true, data: page }, status: 200 } as any);

      await expect(getUsableVouchers(2)).resolves.toEqual(page);
      expect(mockedClient.get).toHaveBeenCalledWith('/vouchers', { params: { page: 2, size: 20 } });
    });
  });

  describe('validateVoucher', () => {
    it('calls GET /vouchers/{code}/validate with trimmed and URL-encoded code and unwraps data', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockVoucher,
        },
        status: 200,
      } as any);

      const result = await validateVoucher('  WELCOME10  ');

      expect(mockedClient.get).toHaveBeenCalledWith('/vouchers/WELCOME10/validate');
      expect(result).toEqual(mockVoucher);
      expect(result.discountPercent).toBe(10);
      expect(result.code).toBe('WELCOME10');
    });

    it('safely URL-encodes special characters in voucher codes', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { ...mockVoucher, code: 'FLASH/50' },
        },
        status: 200,
      } as any);

      await validateVoucher('FLASH/50');

      expect(mockedClient.get).toHaveBeenCalledWith('/vouchers/FLASH%2F50/validate');
    });

    it('propagates API errors through the shared unwrapData architecture', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Voucher not found: INVALID_CODE',
          },
        },
        status: 404,
      } as any);

      await expect(validateVoucher('INVALID_CODE')).rejects.toThrow(ApiError);
    });

    it('propagates VOUCHER_EXHAUSTED 409 error', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'VOUCHER_EXHAUSTED',
            message: 'Voucher has no use left',
          },
        },
        status: 409,
      } as any);

      await expect(validateVoucher('SOLDOUT15')).rejects.toThrow(ApiError);
    });

    it('propagates VOUCHER_EXPIRED 409 error', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'VOUCHER_EXPIRED',
            message: 'Voucher is not valid at this time',
          },
        },
        status: 409,
      } as any);

      await expect(validateVoucher('EXPIRED30')).rejects.toThrow(ApiError);
    });
  });
});
