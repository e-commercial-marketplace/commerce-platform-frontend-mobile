import { apiClient } from '../../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import type { CheckoutRequest, OrderResponse, OrderSummaryResponse, PageResponse } from '../../types/orderApi';
import { confirmReceived, createOrder, getOrder, getOrders } from '../orderService';

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
  cartItemIds: ['cart-item-1'],
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
      unitPrice: '250000.00',
      quantity: 1,
      status: 'PENDING',
      sellerId: 's-1',
    },
  ],
};

describe('orderService extended', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /orders with page and size', async () => {
    const page: PageResponse<OrderSummaryResponse> = {
      content: [
        {
          id: 'order-1',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'COD',
          createdAt: '2026-10-23T10:00:00Z',
          totalAmount: '250000.00',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    };
    mockedClient.get.mockResolvedValue({ data: { success: true, data: page } } as never);
    await expect(getOrders(0, 20)).resolves.toEqual(page);
    expect(mockedClient.get).toHaveBeenCalledWith('/orders', { params: { page: 0, size: 20 } });
  });

  it('GET /orders/{id}', async () => {
    mockedClient.get.mockResolvedValue({ data: { success: true, data: order } } as never);
    await expect(getOrder('order-1')).resolves.toEqual(order);
    expect(mockedClient.get).toHaveBeenCalledWith('/orders/order-1');
  });

  it('PATCH /orders/{id}/received with no body', async () => {
    const completed = { ...order, status: 'COMPLETED' as const };
    mockedClient.patch.mockResolvedValue({ data: { success: true, data: completed } } as never);
    await expect(confirmReceived('order-1')).resolves.toEqual(completed);
    expect(mockedClient.patch).toHaveBeenCalledWith('/orders/order-1/received');
  });

  it('createOrder still works', async () => {
    mockedClient.post.mockResolvedValue({ data: { success: true, data: order }, status: 201 } as never);
    await expect(createOrder(request)).resolves.toEqual(order);
  });
});
