/**
 * Seller Order Fulfillment API service.
 *
 * Provides typed access to backend-supported seller fulfillment endpoints:
 * - GET /seller/order-items
 * - PATCH /seller/order-items/{id}/confirm
 * - PATCH /seller/order-items/{id}/cancel
 * - GET /seller/carriers
 * - POST /seller/shipments
 * - GET /seller/shipments
 * - PATCH /seller/shipments/{id}/status
 *
 * Uses the shared apiClient and unwrapData helper so auth, error handling
 * (ApiError), and base URL configurations are consistent across the app.
 *
 * Contract verified against the backend source:
 * - com.marketplace.controller.SellerOrderController
 * - com.marketplace.controller.SellerShipmentController
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
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
} from '../types/sellerApi';

/**
 * GET /seller/order-items
 * Fetch paginated list of order items belonging to the authenticated seller.
 */
export async function getSellerOrderItems(
  params?: SellerOrderItemFilterParams,
): Promise<PageResponse<SellerOrderItem>> {
  const response = await apiClient.get<ApiResponse<PageResponse<SellerOrderItem>>>(
    '/seller/order-items',
    { params },
  );
  return unwrapData(response);
}

/**
 * PATCH /seller/order-items/{id}/confirm
 * Confirm a PENDING order item for fulfillment.
 */
export async function confirmSellerOrderItem(id: string): Promise<SellerOrderItem> {
  const response = await apiClient.patch<ApiResponse<SellerOrderItem>>(
    `/seller/order-items/${id}/confirm`,
  );
  return unwrapData(response);
}

/**
 * PATCH /seller/order-items/{id}/cancel
 * Cancel an order item with an optional cancellation reason.
 */
export async function cancelSellerOrderItem(
  id: string,
  request?: OrderItemCancelRequest,
): Promise<SellerOrderItem> {
  const response = await apiClient.patch<ApiResponse<SellerOrderItem>>(
    `/seller/order-items/${id}/cancel`,
    request,
  );
  return unwrapData(response);
}

/**
 * GET /seller/carriers
 * Fetch active carriers available for PLATFORM_DELIVERY.
 */
export async function getSellerCarriers(): Promise<Carrier[]> {
  const response = await apiClient.get<ApiResponse<Carrier[]>>('/seller/carriers');
  return unwrapData(response);
}

/**
 * POST /seller/shipments
 * Create a new shipment grouping confirmed order items for an order.
 */
export async function createSellerShipment(
  request: ShipmentCreateRequest,
): Promise<SellerShipment> {
  const response = await apiClient.post<ApiResponse<SellerShipment>>(
    '/seller/shipments',
    request,
  );
  return unwrapData(response);
}

/**
 * GET /seller/shipments
 * Fetch paginated list of shipments belonging to the authenticated seller.
 */
export async function getSellerShipments(
  params?: SellerShipmentFilterParams,
): Promise<PageResponse<SellerShipment>> {
  const response = await apiClient.get<ApiResponse<PageResponse<SellerShipment>>>(
    '/seller/shipments',
    { params },
  );
  return unwrapData(response);
}

/**
 * PATCH /seller/shipments/{id}/status
 * Update shipment status along the fulfillment lifecycle.
 */
export async function updateSellerShipmentStatus(
  id: string,
  request: ShipmentStatusUpdateRequest,
): Promise<SellerShipment> {
  const response = await apiClient.patch<ApiResponse<SellerShipment>>(
    `/seller/shipments/${id}/status`,
    request,
  );
  return unwrapData(response);
}
