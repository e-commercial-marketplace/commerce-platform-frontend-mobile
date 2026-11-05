/**
 * Unit tests for sellerFulfillmentService.
 *
 * Verifies exact HTTP methods, endpoint paths, query parameters,
 * request payloads, response unwrapping, and error propagation.
 */

import { apiClient } from '../../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import type {
  Carrier,
  OrderItemCancelRequest,
  PageResponse,
  SellerOrderItem,
  SellerOrderItemFilterParams,
  SellerShipment,
  SellerShipmentFilterParams,
  ShipmentCreateRequest,
  ShipmentStatusUpdateRequest,
} from '../../types/sellerApi';
import {
  cancelSellerOrderItem,
  confirmSellerOrderItem,
  createSellerShipment,
  getSellerCarriers,
  getSellerOrderItems,
  getSellerShipments,
  updateSellerShipmentStatus,
} from '../sellerFulfillmentService';

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

const mockOrderItem: SellerOrderItem = {
  id: 'item-uuid-1',
  orderId: 'order-uuid-1',
  productId: 'prod-uuid-1',
  productName: 'Mechanical Keyboard',
  unitPrice: '1500000.00',
  quantity: 1,
  status: 'PENDING',
  sellerId: 'seller-uuid-1',
};

const mockCarrier: Carrier = {
  id: 'carrier-uuid-1',
  name: 'Giao Hang Nhanh',
  active: true,
};

const mockShipment: SellerShipment = {
  id: 'shipment-uuid-1',
  orderId: 'order-uuid-1',
  sellerId: 'seller-uuid-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: {
    id: 'carrier-uuid-1',
    name: 'Giao Hang Nhanh',
  },
  status: 'PENDING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'item-uuid-1', quantity: 1 }],
};

describe('sellerFulfillmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSellerOrderItems', () => {
    it('GETs /seller/order-items with query params and unwraps data', async () => {
      const pageData: PageResponse<SellerOrderItem> = {
        content: [mockOrderItem],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      };

      mockedClient.get.mockResolvedValue({
        data: { success: true, data: pageData },
        status: 200,
      } as never);

      const params: SellerOrderItemFilterParams = {
        status: 'PENDING',
        orderId: 'order-uuid-1',
        page: 0,
        size: 20,
      };

      const result = await getSellerOrderItems(params);
      expect(result).toEqual(pageData);
      expect(mockedClient.get).toHaveBeenCalledWith('/seller/order-items', { params });
    });

    it('GETs /seller/order-items without params when omitted', async () => {
      const pageData: PageResponse<SellerOrderItem> = {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      };

      mockedClient.get.mockResolvedValue({
        data: { success: true, data: pageData },
        status: 200,
      } as never);

      const result = await getSellerOrderItems();
      expect(result).toEqual(pageData);
      expect(mockedClient.get).toHaveBeenCalledWith('/seller/order-items', { params: undefined });
    });

    it('propagates ApiError on backend failure', async () => {
      mockedClient.get.mockResolvedValue({
        data: {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Seller not approved' },
        },
        status: 403,
      } as never);

      await expect(getSellerOrderItems()).rejects.toMatchObject({
        name: 'ApiError',
        code: 'UNAUTHORIZED',
        status: 403,
      });
    });
  });

  describe('confirmSellerOrderItem', () => {
    it('PATCHes /seller/order-items/{id}/confirm and unwraps confirmed item', async () => {
      const confirmedItem: SellerOrderItem = {
        ...mockOrderItem,
        status: 'CONFIRMED',
      };

      mockedClient.patch.mockResolvedValue({
        data: { success: true, data: confirmedItem },
        status: 200,
      } as never);

      const result = await confirmSellerOrderItem('item-uuid-1');
      expect(result).toEqual(confirmedItem);
      expect(mockedClient.patch).toHaveBeenCalledWith('/seller/order-items/item-uuid-1/confirm');
    });

    it('surfaces backend 400 error when confirming non-PENDING item', async () => {
      mockedClient.patch.mockResolvedValue({
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Only a PENDING order item can be confirmed',
          },
        },
        status: 400,
      } as never);

      await expect(confirmSellerOrderItem('item-uuid-1')).rejects.toMatchObject({
        name: 'ApiError',
        code: 'VALIDATION_ERROR',
        status: 400,
      });
    });
  });

  describe('cancelSellerOrderItem', () => {
    it('PATCHes /seller/order-items/{id}/cancel without body when request is undefined', async () => {
      const cancelledItem: SellerOrderItem = {
        ...mockOrderItem,
        status: 'CANCELLED',
      };

      mockedClient.patch.mockResolvedValue({
        data: { success: true, data: cancelledItem },
        status: 200,
      } as never);

      const result = await cancelSellerOrderItem('item-uuid-1');
      expect(result).toEqual(cancelledItem);
      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/order-items/item-uuid-1/cancel',
        undefined,
      );
    });

    it('PATCHes /seller/order-items/{id}/cancel with cancelReason in request body', async () => {
      const cancelledItem: SellerOrderItem = {
        ...mockOrderItem,
        status: 'CANCELLED',
      };
      const request: OrderItemCancelRequest = { cancelReason: 'Out of stock at warehouse' };

      mockedClient.patch.mockResolvedValue({
        data: { success: true, data: cancelledItem },
        status: 200,
      } as never);

      const result = await cancelSellerOrderItem('item-uuid-1', request);
      expect(result).toEqual(cancelledItem);
      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/order-items/item-uuid-1/cancel',
        request,
      );
    });

    it('rejects with ApiError when item cannot be cancelled after shipment creation', async () => {
      mockedClient.patch.mockResolvedValue({
        data: {
          success: false,
          error: {
            code: 'CANNOT_CANCEL_AFTER_SHIPMENT',
            message: 'Cancel the shipment instead',
          },
        },
        status: 400,
      } as never);

      await expect(
        cancelSellerOrderItem('item-uuid-1', { cancelReason: 'Mistake' }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        code: 'CANNOT_CANCEL_AFTER_SHIPMENT',
        status: 400,
      });
    });
  });

  describe('getSellerCarriers', () => {
    it('GETs /seller/carriers and returns carrier list', async () => {
      mockedClient.get.mockResolvedValue({
        data: { success: true, data: [mockCarrier] },
        status: 200,
      } as never);

      const result = await getSellerCarriers();
      expect(result).toEqual([mockCarrier]);
      expect(mockedClient.get).toHaveBeenCalledWith('/seller/carriers');
    });
  });

  describe('createSellerShipment', () => {
    it('POSTs /seller/shipments with PLATFORM_DELIVERY shape requiring carrierId', async () => {
      const request: ShipmentCreateRequest = {
        orderId: 'order-uuid-1',
        deliveryMethod: 'PLATFORM_DELIVERY',
        carrierId: 'carrier-uuid-1',
        orderItemIds: ['item-uuid-1'],
      };

      mockedClient.post.mockResolvedValue({
        data: { success: true, data: mockShipment },
        status: 201,
      } as never);

      const result = await createSellerShipment(request);
      expect(result).toEqual(mockShipment);
      expect(mockedClient.post).toHaveBeenCalledWith('/seller/shipments', request);
    });

    it('POSTs /seller/shipments with SELF_DELIVERY shape (carrierId null/undefined)', async () => {
      const request: ShipmentCreateRequest = {
        orderId: 'order-uuid-1',
        deliveryMethod: 'SELF_DELIVERY',
        carrierId: null,
        orderItemIds: ['item-uuid-1'],
      };

      const selfShipment: SellerShipment = {
        ...mockShipment,
        deliveryMethod: 'SELF_DELIVERY',
        carrier: null,
      };

      mockedClient.post.mockResolvedValue({
        data: { success: true, data: selfShipment },
        status: 201,
      } as never);

      const result = await createSellerShipment(request);
      expect(result).toEqual(selfShipment);
      expect(mockedClient.post).toHaveBeenCalledWith('/seller/shipments', request);
    });

    it('propagates transport error on failure', async () => {
      const transportError = new ApiError('Connection lost', NETWORK_ERROR_CODE, null);
      mockedClient.post.mockRejectedValue(transportError);

      await expect(
        createSellerShipment({
          orderId: 'o-1',
          deliveryMethod: 'SELF_DELIVERY',
          orderItemIds: ['oi-1'],
        }),
      ).rejects.toBe(transportError);
    });
  });

  describe('getSellerShipments', () => {
    it('GETs /seller/shipments with status, orderId, page, size filters', async () => {
      const pageData: PageResponse<SellerShipment> = {
        content: [mockShipment],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      };

      mockedClient.get.mockResolvedValue({
        data: { success: true, data: pageData },
        status: 200,
      } as never);

      const params: SellerShipmentFilterParams = {
        status: 'PENDING',
        orderId: 'order-uuid-1',
        page: 0,
        size: 10,
      };

      const result = await getSellerShipments(params);
      expect(result).toEqual(pageData);
      expect(mockedClient.get).toHaveBeenCalledWith('/seller/shipments', { params });
    });
  });

  describe('updateSellerShipmentStatus', () => {
    it('PATCHes /seller/shipments/{id}/status without trackingCode when not SHIPPED', async () => {
      const request: ShipmentStatusUpdateRequest = {
        status: 'PREPARING',
      };
      const updatedShipment: SellerShipment = {
        ...mockShipment,
        status: 'PREPARING',
      };

      mockedClient.patch.mockResolvedValue({
        data: { success: true, data: updatedShipment },
        status: 200,
      } as never);

      const result = await updateSellerShipmentStatus('shipment-uuid-1', request);
      expect(result).toEqual(updatedShipment);
      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/shipments/shipment-uuid-1/status',
        request,
      );
    });

    it('PATCHes /seller/shipments/{id}/status with trackingCode when marking SHIPPED', async () => {
      const request: ShipmentStatusUpdateRequest = {
        status: 'SHIPPED',
        trackingCode: 'GHN-TRACK-123456',
      };
      const shippedShipment: SellerShipment = {
        ...mockShipment,
        status: 'SHIPPED',
        trackingCode: 'GHN-TRACK-123456',
        shippedAt: '2026-10-28T12:00:00Z',
      };

      mockedClient.patch.mockResolvedValue({
        data: { success: true, data: shippedShipment },
        status: 200,
      } as never);

      const result = await updateSellerShipmentStatus('shipment-uuid-1', request);
      expect(result).toEqual(shippedShipment);
      expect(result.trackingCode).toBe('GHN-TRACK-123456');
      expect(result.shippedAt).toBe('2026-10-28T12:00:00Z');
      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/shipments/shipment-uuid-1/status',
        request,
      );
    });
  });
});
