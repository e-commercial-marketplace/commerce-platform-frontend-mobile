/**
 * Order API service - thin wrapper over the real backend checkout endpoint.
 *
 * Uses the shared `apiClient` (base URL, Bearer header, 401 refresh behavior)
 * and the shared `unwrapData` helper, so checkout inherits the same auth and
 * error handling as every other feature.
 *
 * Contract verified against the backend source:
 * - POST /orders -> 201 ApiResponse<OrderResponse>
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { CheckoutRequest, OrderResponse } from '../types/orderApi';

/** POST /orders - purchases exactly the selected cart lines (CUSTOMER only). */
export async function createOrder(input: CheckoutRequest): Promise<OrderResponse> {
  const response = await apiClient.post<ApiResponse<OrderResponse>>('/orders', input);
  return unwrapData(response);
}
