/**
 * TanStack Query hooks for Seller Order Fulfillment.
 *
 * Implements data fetching and mutations for seller fulfillment lifecycle:
 * - Queries:
 *   - `useSellerOrderItems`: paginated/filtered list of seller order items
 *   - `useSellerShipments`: paginated/filtered list of seller shipments
 *   - `useSellerCarriers`: active shipping carriers for PLATFORM_DELIVERY
 * - Mutations:
 *   - `useConfirmSellerOrderItem`: transitions item from PENDING to CONFIRMED
 *   - `useCancelSellerOrderItem`: cancels item with optional cancelReason
 *   - `useCreateSellerShipment`: groups CONFIRMED items into a new shipment
 *   - `useUpdateSellerShipmentStatus`: advances shipment lifecycle
 *
 * Cache invalidation follows exact business relationship rules:
 * - Confirm/cancel item: invalidates seller order items
 * - Create shipment: invalidates seller order items and seller shipments
 * - Update shipment status: invalidates seller shipments and seller order items
 *   (backend can cancel items upon shipment cancellation)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import {
  cancelSellerOrderItem,
  confirmSellerOrderItem,
  createSellerShipment,
  getSellerCarriers,
  getSellerOrderItems,
  getSellerShipments,
  updateSellerShipmentStatus,
} from '../services/sellerFulfillmentService';
import type {
  OrderItemCancelRequest,
  SellerOrderItemFilterParams,
  SellerShipmentFilterParams,
  ShipmentCreateRequest,
  ShipmentStatus,
  ShipmentStatusUpdateRequest,
} from '../types/sellerApi';

/**
 * Hook to query seller order items with optional filters and pagination.
 */
export function useSellerOrderItems(
  params: SellerOrderItemFilterParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.sellerFulfillment.orderItems.list(params),
    queryFn: () => getSellerOrderItems(params),
    enabled,
  });
}

/**
 * Hook to query seller shipments with optional filters and pagination.
 */
export function useSellerShipments(
  params: SellerShipmentFilterParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.sellerFulfillment.shipments.list(params),
    queryFn: () => getSellerShipments(params),
    enabled,
  });
}

/**
 * Hook to query active carriers available for platform delivery.
 */
export function useSellerCarriers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sellerFulfillment.carriers.list(),
    queryFn: () => getSellerCarriers(),
    enabled,
  });
}

/**
 * Mutation to confirm a PENDING order item.
 * Invalidates seller order items query cache on success.
 */
export function useConfirmSellerOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderItemId: string) => confirmSellerOrderItem(orderItemId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
      return data;
    },
  });
}

/**
 * Variables for cancelling an order item.
 */
export type CancelSellerOrderItemVariables = {
  orderItemId: string;
  request?: OrderItemCancelRequest;
  cancelReason?: string;
};

/**
 * Mutation to cancel an order item.
 * Supports optional cancelReason in request payload.
 * Invalidates seller order items query cache on success.
 */
export function useCancelSellerOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderItemId, request, cancelReason }: CancelSellerOrderItemVariables) => {
      const payload: OrderItemCancelRequest | undefined =
        request ?? (cancelReason !== undefined ? { cancelReason } : undefined);
      return cancelSellerOrderItem(orderItemId, payload);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
      return data;
    },
  });
}

/**
 * Mutation to create a shipment.
 * Invalidates both seller order items and seller shipments query caches on success.
 */
export function useCreateSellerShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ShipmentCreateRequest) => createSellerShipment(request),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.shipments.all,
      });
      return data;
    },
  });
}

/**
 * Variables for updating shipment status.
 */
export type UpdateSellerShipmentStatusVariables = {
  shipmentId: string;
  request?: ShipmentStatusUpdateRequest;
  status?: ShipmentStatus;
  trackingCode?: string | null;
};

/**
 * Mutation to update shipment status.
 * Invalidates seller shipments and seller order items (since CANCELLED shipment cancels items).
 */
export function useUpdateSellerShipmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      shipmentId,
      request,
      status,
      trackingCode,
    }: UpdateSellerShipmentStatusVariables) => {
      const payload: ShipmentStatusUpdateRequest =
        request ?? {
          status: status!,
          ...(trackingCode !== undefined ? { trackingCode } : {}),
        };
      return updateSellerShipmentStatus(shipmentId, payload);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.shipments.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerFulfillment.orderItems.all,
      });
      return data;
    },
  });
}
