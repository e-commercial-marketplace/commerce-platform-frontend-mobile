/**
 * Order API service - thin wrapper over the real backend order endpoints.
 *
 * Uses the shared `apiClient` (base URL, Bearer header, 401 refresh behavior)
 * and the shared `unwrapData` helper, so orders inherit the same auth and
 * error handling as every other feature.
 *
 * Contract verified against the backend source:
 * - POST /orders -> 201 ApiResponse<OrderResponse>
 * - GET /orders -> 200 ApiResponse<PageResponse<OrderSummaryResponse>>
 * - GET /orders/{id} -> 200 ApiResponse<OrderResponse>
 * - PATCH /orders/{id}/received -> 200 ApiResponse<OrderResponse>
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  CheckoutRequest,
  OrderResponse,
  OrderSummaryResponse,
  PageResponse,
} from '../types/orderApi';

/** POST /orders - purchases exactly the selected cart lines (CUSTOMER only). */
export async function createOrder(input: CheckoutRequest): Promise<OrderResponse> {
  const response = await apiClient.post<ApiResponse<OrderResponse>>('/orders', input);
  return unwrapData(response);
}

/** GET /orders - paginated list of customer's orders (newest first). */
export async function getOrders(page: number, size: number): Promise<PageResponse<OrderSummaryResponse>> {
  const response = await apiClient.get<ApiResponse<PageResponse<OrderSummaryResponse>>>('/orders', {
    params: { page, size },
  });
  return unwrapData(response);
}

/** GET /orders/{id} - order detail for the authenticated customer (owner only). */
export async function getOrder(orderId: string): Promise<OrderResponse> {
  const response = await apiClient.get<ApiResponse<OrderResponse>>(`/orders/${orderId}`);
  return unwrapData(response);
}

/** PATCH /orders/{id}/received - confirm received (only DELIVERED orders). */
export async function confirmReceived(orderId: string): Promise<OrderResponse> {
  const response = await apiClient.patch<ApiResponse<OrderResponse>>(`/orders/${orderId}/received`);
  return unwrapData(response);
}
