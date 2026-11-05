import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import type { OrderResponse, OrderSummaryResponse } from '../../types/orderApi';
import { confirmReceived, getOrder, getOrders } from '../../services/orderService';
import { useConfirmReceived, useOrderDetail, useOrders } from '../useOrders';

jest.mock('../../services/orderService', () => ({
  getOrders: jest.fn(),
  getOrder: jest.fn(),
  confirmReceived: jest.fn(),
}));

const mockedGetOrders = getOrders as jest.MockedFunction<typeof getOrders>;
const mockedGetOrder = getOrder as jest.MockedFunction<typeof getOrder>;
const mockedConfirmReceived = confirmReceived as jest.MockedFunction<typeof confirmReceived>;

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

const summary: OrderSummaryResponse = {
  id: 'order-1',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  createdAt: '2026-10-23T10:00:00Z',
  totalAmount: '250000.00',
};

const detail: OrderResponse = {
  id: 'order-1',
  status: 'DELIVERED',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  paymentUrl: null,
  createdAt: '2026-10-23T10:00:00Z',
  shippingAddress: '12 Main Street',
  shippingFee: '0.00',
  discountAmount: '0.00',
  totalAmount: '250000.00',
  voucherCode: null,
  shipments: [],
  items: [
    {
      id: 'oi-1',
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

describe('useOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getOrders with page and size', async () => {
    mockedGetOrders.mockResolvedValue({
      content: [summary],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });

    const client = makeClient();
    const { result } = renderHook(() => useOrders(true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetOrders).toHaveBeenCalledWith(0, 20);
  });

  it('loads next page when hasNextPage', async () => {
    mockedGetOrders
      .mockResolvedValueOnce({
        content: [summary],
        page: 0,
        size: 20,
        totalElements: 40,
        totalPages: 2,
        first: true,
        last: false,
      })
      .mockResolvedValueOnce({
        content: [{ ...summary, id: 'order-2' }],
        page: 1,
        size: 20,
        totalElements: 40,
        totalPages: 2,
        first: false,
        last: true,
      });

    const client = makeClient();
    const { result } = renderHook(() => useOrders(true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages.length).toBe(2));
    expect(result.current.data?.pages[1].content[0].id).toBe('order-2');
    expect(mockedGetOrders).toHaveBeenCalledTimes(2);
    expect(mockedGetOrders).toHaveBeenLastCalledWith(1, 20);
  });

  it('does not fetch next page when all orders fit on first page (last true)', async () => {
    mockedGetOrders.mockResolvedValue({
      content: [summary, { ...summary, id: 'order-2' }, { ...summary, id: 'order-3' }],
      page: 0,
      size: 20,
      totalElements: 3,
      totalPages: 1,
      first: true,
      last: true,
    });

    const client = makeClient();
    const { result } = renderHook(() => useOrders(true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
    expect(mockedGetOrders).toHaveBeenCalledTimes(1);
  });

  it('stops pagination when last is false but totalPages indicates no next page', async () => {
    mockedGetOrders.mockResolvedValue({
      content: [summary],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: false,
    });

    const client = makeClient();
    const { result } = renderHook(() => useOrders(true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
    expect(mockedGetOrders).toHaveBeenCalledTimes(1);
  });
});

describe('useOrderDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches order detail', async () => {
    mockedGetOrder.mockResolvedValue(detail);

    const client = makeClient();
    const { result } = renderHook(() => useOrderDetail('order-1', true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetOrder).toHaveBeenCalledWith('order-1');
    expect(result.current.data?.status).toBe('DELIVERED');
  });
});

describe('useConfirmReceived', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates detail cache and invalidates lists on success', async () => {
    const completed = { ...detail, status: 'COMPLETED' as const };
    mockedConfirmReceived.mockResolvedValue(completed);

    const client = makeClient();
    client.setQueryData(queryKeys.orders.detail('order-1'), detail);
    client.setQueryData(queryKeys.orders.lists, { pages: [], pageParams: [] });

    const { result } = renderHook(() => useConfirmReceived(), { wrapper: wrapper(client) });

    await result.current.mutateAsync('order-1');
    expect(mockedConfirmReceived).toHaveBeenCalledWith('order-1');
    expect(client.getQueryData(queryKeys.orders.detail('order-1'))).toEqual(completed);
  });
});
