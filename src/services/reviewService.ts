/**
 * Product review API service - thin wrapper over backend review endpoints.
 *
 * Uses the shared `apiClient` (so base URL, Bearer auth header, and 401 refresh
 * behavior are inherited automatically) and `unwrapData` helper to convert the
 * backend's `ApiResponse` envelope into the payload or throw a typed `ApiError`.
 *
 * Contract verified against the backend source:
 * - GET  /products/{productId}/reviews -> 200 ApiResponse<PageResponse<ReviewResponse>> (Public)
 * - POST /products/{productId}/reviews -> 201 ApiResponse<ReviewResponse> (CUSTOMER only)
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { PageResponse, ReviewCreateRequest, ReviewResponse } from '../types/reviewApi';

/**
 * GET /api/v1/products/{productId}/reviews - public paginated reviews list (newest first).
 */
export async function getProductReviews(
  productId: string,
  page = 0,
  size = 20,
): Promise<PageResponse<ReviewResponse>> {
  const response = await apiClient.get<ApiResponse<PageResponse<ReviewResponse>>>(
    `/products/${productId}/reviews`,
    {
      params: { page, size },
    },
  );
  return unwrapData(response);
}

/**
 * POST /api/v1/products/{productId}/reviews - creates a review for an eligible completed purchase.
 */
export async function createReview(
  productId: string,
  payload: ReviewCreateRequest,
): Promise<ReviewResponse> {
  const response = await apiClient.post<ApiResponse<ReviewResponse>>(
    `/products/${productId}/reviews`,
    payload,
  );
  return unwrapData(response);
}
