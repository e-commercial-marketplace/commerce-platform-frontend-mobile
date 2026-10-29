/**
 * Unit tests for the VNPay payment service.
 *
 * Verifies the transport contract against backend source:
 * - POST /payments/vnpay/create
 * - Exact body { orderId }
 * - Unwrapping 200 OK ApiResponse<VnpayPaymentResponse>
 * - Preserving fields (paymentId, orderId, amount decimal string, status, paymentUrl)
 * - Propagating ApiError and 409 ORDER_NOT_PAYABLE
 */

import { apiClient } from '../../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import type { VnpayPaymentResponse } from '../../types/paymentApi';
import { createVnpayPayment } from '../paymentService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const mockPaymentResponse: VnpayPaymentResponse = {
  paymentId: 'payment-uuid-1',
  orderId: 'order-uuid-1',
  amount: '2990000.00',
  status: 'PENDING',
  paymentUrl:
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=299000000&vnp_TxnRef=123&vnp_SecureHash=abc',
};

describe('paymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POSTs exact orderId body to /payments/vnpay/create and unwraps 200 response data', async () => {
    mockedClient.post.mockResolvedValue({
      data: { success: true, data: mockPaymentResponse },
      status: 200,
    } as never);

    const result = await createVnpayPayment('order-uuid-1');

    expect(mockedClient.post).toHaveBeenCalledWith('/payments/vnpay/create', {
      orderId: 'order-uuid-1',
    });
    expect(result).toEqual(mockPaymentResponse);
  });

  it('preserves all payment response fields without mutation', async () => {
    mockedClient.post.mockResolvedValue({
      data: { success: true, data: mockPaymentResponse },
      status: 200,
    } as never);

    const result = await createVnpayPayment('order-uuid-1');

    expect(result.paymentId).toBe('payment-uuid-1');
    expect(result.orderId).toBe('order-uuid-1');
    expect(result.amount).toBe('2990000.00');
    expect(result.status).toBe('PENDING');
    expect(result.paymentUrl).toBe(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=299000000&vnp_TxnRef=123&vnp_SecureHash=abc',
    );
  });

  it('surfaces backend 409 ORDER_NOT_PAYABLE as typed ApiError', async () => {
    mockedClient.post.mockResolvedValue({
      data: {
        success: false,
        error: {
          code: 'ORDER_NOT_PAYABLE',
          message: 'The order cannot be paid with VNPAY',
        },
      },
      status: 409,
    } as never);

    await expect(createVnpayPayment('order-uuid-1')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'ORDER_NOT_PAYABLE',
      status: 409,
      message: 'The order cannot be paid with VNPAY',
    });
  });

  it('propagates transport / network errors unchanged', async () => {
    const networkError = new ApiError(
      'Unable to connect to the server. Please try again.',
      NETWORK_ERROR_CODE,
      null,
    );
    mockedClient.post.mockRejectedValue(networkError);

    await expect(createVnpayPayment('order-uuid-1')).rejects.toBe(networkError);
  });
});
