/**
 * Unit tests for the order checkout service.
 *
 * Only the transport contract is asserted: HTTP method, path, exact request
 * body, 201 ApiResponse unwrap, wire string money values and error propagation.
 */

import { apiClient } from '../../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import type { CheckoutRequest, OrderResponse } from '../../types/orderApi';
import { createOrder } from '../orderService';

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

const request: CheckoutRequest = {
  cartItemIds: ['cart-item-1', 'cart-item-2'],
  shippingAddress: '12 Main Street, District 1',
  paymentMethod: 'COD',
};

const order: OrderResponse = {
  id: 'order-1',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  paymentUrl: null,
  createdAt: '2026-10-23T10:00:00Z',
  shippingAddress: '12 Main Street, District 1',
  shippingFee: '0.00',
  discountAmount: '0.00',
  totalAmount: '250000.00',
  voucherCode: null,
  shipments: [],
  items: [
    {
      id: 'order-item-1',
      orderId: 'order-1',
      productId: 'p-1',
      productName: 'Phone',
      unitPrice: '100000.00',
      quantity: 2,
      status: 'PENDING',
      sellerId: 's-1',
    },
  ],
};

describe('orderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POSTs the exact checkout body to /orders and unwraps 201 data', async () => {
    mockedClient.post.mockResolvedValue({
      data: { success: true, data: order },
      status: 201,
    } as never);

    await expect(createOrder(request)).resolves.toEqual(order);

    expect(mockedClient.post).toHaveBeenCalledWith('/orders', {
      cartItemIds: ['cart-item-1', 'cart-item-2'],
      shippingAddress: '12 Main Street, District 1',
      paymentMethod: 'COD',
    });
  });

  it('preserves wire money strings and nullable response fields', async () => {
    mockedClient.post.mockResolvedValue({
      data: { success: true, data: order },
      status: 201,
    } as never);

    const result = await createOrder(request);

    expect(result.totalAmount).toBe('250000.00');
    expect(result.shippingFee).toBe('0.00');
    expect(result.discountAmount).toBe('0.00');
    expect(result.items[0].unitPrice).toBe('100000.00');
    expect(result.paymentUrl).toBeNull();
    expect(result.voucherCode).toBeNull();
  });

  it('surfaces a backend error envelope as ApiError', async () => {
    mockedClient.post.mockResolvedValue({
      data: {
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough stock for Phone',
        },
      },
      status: 409,
    } as never);

    await expect(createOrder(request)).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INSUFFICIENT_STOCK',
      status: 409,
      message: 'Not enough stock for Phone',
    });
  });

  it('propagates transport errors unchanged', async () => {
    const networkError = new ApiError(
      'Unable to connect to the server. Please try again.',
      NETWORK_ERROR_CODE,
      null,
    );
    mockedClient.post.mockRejectedValue(networkError);

    await expect(createOrder(request)).rejects.toBe(networkError);
  });
});
