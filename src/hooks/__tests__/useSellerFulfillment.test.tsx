import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import type {
  Carrier,
  PageResponse,
  SellerOrderItem,
  SellerShipment,
  ShipmentCreateRequest,
} from '../../types/sellerApi';
import {
  cancelSellerOrderItem,
  confirmSellerOrderItem,
  createSellerShipment,
  getSellerCarriers,
  getSellerOrderItems,
  getSellerShipments,
  updateSellerShipmentStatus,
} from '../../services/sellerFulfillmentService';
import {
  useCancelSellerOrderItem,
  useConfirmSellerOrderItem,
  useCreateSellerShipment,
  useSellerCarriers,
  useSellerOrderItems,
  useSellerShipments,
  useUpdateSellerShipmentStatus,
} from '../useSellerFulfillment';

jest.mock('../../services/sellerFulfillmentService', () => ({
  getSellerOrderItems: jest.fn(),
  confirmSellerOrderItem: jest.fn(),
  cancelSellerOrderItem: jest.fn(),
  getSellerCarriers: jest.fn(),
  createSellerShipment: jest.fn(),
  getSellerShipments: jest.fn(),
  updateSellerShipmentStatus: jest.fn(),
}));

const mockedGetSellerOrderItems = getSellerOrderItems as jest.MockedFunction<
  typeof getSellerOrderItems
>;
const mockedConfirmSellerOrderItem = confirmSellerOrderItem as jest.MockedFunction<
  typeof confirmSellerOrderItem
>;
const mockedCancelSellerOrderItem = cancelSellerOrderItem as jest.MockedFunction<
  typeof cancelSellerOrderItem
>;
const mockedGetSellerCarriers = getSellerCarriers as jest.MockedFunction<
  typeof getSellerCarriers
>;
const mockedCreateSellerShipment = createSellerShipment as jest.MockedFunction<
  typeof createSellerShipment
>;
const mockedGetSellerShipments = getSellerShipments as jest.MockedFunction<
  typeof getSellerShipments
>;
const mockedUpdateSellerShipmentStatus = updateSellerShipmentStatus as jest.MockedFunction<
  typeof updateSellerShipmentStatus
>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mockOrderItem: SellerOrderItem = {
  id: 'oi-1',
  orderId: 'order-1',
  productId: 'p-1',
  productName: 'Gaming Mouse',
  unitPrice: '500000.00',
  quantity: 2,
  status: 'PENDING',
  sellerId: 's-1',
};

const mockCarrier: Carrier = {
  id: 'carrier-1',
  name: 'Standard Carrier',
  active: true,
};

const mockShipment: SellerShipment = {
  id: 'shipment-1',
  orderId: 'order-1',
  sellerId: 's-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-1', name: 'Standard Carrier' },
  status: 'PENDING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'oi-1', quantity: 2 }],
};

describe('useSellerFulfillment hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSellerOrderItems', () => {
    it('fetches seller order items with filters and uses filter-sensitive key', async () => {
      const pageData: PageResponse<SellerOrderItem> = {
        content: [mockOrderItem],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      };
      mockedGetSellerOrderItems.mockResolvedValue(pageData);

      const client = makeClient();
      const filters = { status: 'PENDING' as const, page: 0, size: 20 };
      const { result } = renderHook(() => useSellerOrderItems(filters), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedGetSellerOrderItems).toHaveBeenCalledWith(filters);
      expect(result.current.data).toEqual(pageData);

      // Verify cache key in client
      const cached = client.getQueryData(
        queryKeys.sellerFulfillment.orderItems.list(filters),
      );
      expect(cached).toEqual(pageData);
    });

    it('respects enabled flag when false', () => {
      const client = makeClient();
      const { result } = renderHook(() => useSellerOrderItems({}, false), {
        wrapper: createWrapper(client),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedGetSellerOrderItems).not.toHaveBeenCalled();
    });
  });

  describe('useSellerShipments', () => {
    it('fetches seller shipments with filters', async () => {
      const pageData: PageResponse<SellerShipment> = {
        content: [mockShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      };
      mockedGetSellerShipments.mockResolvedValue(pageData);

      const client = makeClient();
      const filters = { status: 'PREPARING' as const, page: 0 };
      const { result } = renderHook(() => useSellerShipments(filters), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedGetSellerShipments).toHaveBeenCalledWith(filters);
      expect(result.current.data).toEqual(pageData);
    });
  });

  describe('useSellerCarriers', () => {
    it('fetches carriers using carrier query key', async () => {
      mockedGetSellerCarriers.mockResolvedValue([mockCarrier]);

      const client = makeClient();
      const { result } = renderHook(() => useSellerCarriers(), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedGetSellerCarriers).toHaveBeenCalled();
      expect(result.current.data).toEqual([mockCarrier]);
      expect(
        client.getQueryData(queryKeys.sellerFulfillment.carriers.list()),
      ).toEqual([mockCarrier]);
    });
  });

  describe('useConfirmSellerOrderItem', () => {
    it('calls confirmSellerOrderItem and invalidates seller order items cache on success', async () => {
      const confirmed = { ...mockOrderItem, status: 'CONFIRMED' as const };
      mockedConfirmSellerOrderItem.mockResolvedValue(confirmed);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useConfirmSellerOrderItem(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync('oi-1');

      expect(mockedConfirmSellerOrderItem).toHaveBeenCalledWith('oi-1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
    });
  });

  describe('useCancelSellerOrderItem', () => {
    it('calls cancelSellerOrderItem with cancelReason and invalidates order items', async () => {
      const cancelled = { ...mockOrderItem, status: 'CANCELLED' as const };
      mockedCancelSellerOrderItem.mockResolvedValue(cancelled);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useCancelSellerOrderItem(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync({
        orderItemId: 'oi-1',
        cancelReason: 'Customer requested cancellation',
      });

      expect(mockedCancelSellerOrderItem).toHaveBeenCalledWith('oi-1', {
        cancelReason: 'Customer requested cancellation',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
    });

    it('supports calling cancel without cancelReason', async () => {
      const cancelled = { ...mockOrderItem, status: 'CANCELLED' as const };
      mockedCancelSellerOrderItem.mockResolvedValue(cancelled);

      const client = makeClient();

      const { result } = renderHook(() => useCancelSellerOrderItem(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync({ orderItemId: 'oi-1' });

      expect(mockedCancelSellerOrderItem).toHaveBeenCalledWith('oi-1', undefined);
    });
  });

  describe('useCreateSellerShipment', () => {
    it('creates PLATFORM_DELIVERY shipment and invalidates both order items and shipments', async () => {
      mockedCreateSellerShipment.mockResolvedValue(mockShipment);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useCreateSellerShipment(), {
        wrapper: createWrapper(client),
      });

      const payload: ShipmentCreateRequest = {
        orderId: 'order-1',
        deliveryMethod: 'PLATFORM_DELIVERY',
        carrierId: 'carrier-1',
        orderItemIds: ['oi-1'],
      };

      await result.current.mutateAsync(payload);

      expect(mockedCreateSellerShipment).toHaveBeenCalledWith(payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.shipments.all,
      });
    });

    it('creates SELF_DELIVERY shipment with null carrierId', async () => {
      const selfShipment = { ...mockShipment, deliveryMethod: 'SELF_DELIVERY' as const, carrier: null };
      mockedCreateSellerShipment.mockResolvedValue(selfShipment);

      const client = makeClient();

      const { result } = renderHook(() => useCreateSellerShipment(), {
        wrapper: createWrapper(client),
      });

      const payload: ShipmentCreateRequest = {
        orderId: 'order-1',
        deliveryMethod: 'SELF_DELIVERY',
        carrierId: null,
        orderItemIds: ['oi-1'],
      };

      await result.current.mutateAsync(payload);

      expect(mockedCreateSellerShipment).toHaveBeenCalledWith(payload);
    });
  });

  describe('useUpdateSellerShipmentStatus', () => {
    it('updates status to SHIPPED with trackingCode and invalidates shipments and order items', async () => {
      const shipped = {
        ...mockShipment,
        status: 'SHIPPED' as const,
        trackingCode: 'TRACK-999',
        shippedAt: '2026-10-28T12:00:00Z',
      };
      mockedUpdateSellerShipmentStatus.mockResolvedValue(shipped);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSellerShipmentStatus(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync({
        shipmentId: 'shipment-1',
        status: 'SHIPPED',
        trackingCode: 'TRACK-999',
      });

      expect(mockedUpdateSellerShipmentStatus).toHaveBeenCalledWith('shipment-1', {
        status: 'SHIPPED',
        trackingCode: 'TRACK-999',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.shipments.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
    });

    it('supports direct request object in variables', async () => {
      const delivering = { ...mockShipment, status: 'DELIVERED' as const };
      mockedUpdateSellerShipmentStatus.mockResolvedValue(delivering);

      const client = makeClient();

      const { result } = renderHook(() => useUpdateSellerShipmentStatus(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync({
        shipmentId: 'shipment-1',
        request: { status: 'DELIVERED' },
      });

      expect(mockedUpdateSellerShipmentStatus).toHaveBeenCalledWith('shipment-1', {
        status: 'DELIVERED',
      });
    });
  });
});
