/**
 * Seller Product Management API service.
 *
 * Provides typed access to backend-supported seller product endpoints:
 * - GET /seller/products
 * - GET /seller/products/{id}
 * - POST /seller/products
 * - PATCH /seller/products/{id}
 * - PATCH /seller/products/{id}/stock
 * - DELETE /seller/products/{id}
 *
 * Uses the shared apiClient with automatic Bearer token auth, unwrapData, and unwrapVoid.
 * Contract verified against backend controller: com.marketplace.controller.SellerProductController.
 */

import { apiClient, unwrapData, unwrapVoid } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  PageResponseDto,
  ProductCreateRequest,
  ProductDetailDto,
  ProductSummaryDto,
  ProductUpdateRequest,
  SellerProductListFilters,
  StockUpdateRequest,
} from '../types/sellerProductApi';

/**
 * GET /seller/products
 * Fetch paginated list of products owned by the authenticated seller.
 * Supports filtering by keyword search (`q`), visibility status (`active`), and pagination (`page`, `size`).
 */
export async function getSellerProducts(
  filters: SellerProductListFilters = {},
): Promise<PageResponseDto<ProductSummaryDto>> {
  const params: Record<string, string | number | boolean> = {};

  if (filters.q != null && filters.q.trim().length > 0) {
    params.q = filters.q.trim();
  }
  // Explicit boolean check ensures active=false is not accidentally omitted
  if (typeof filters.active === 'boolean') {
    params.active = filters.active;
  }
  if (typeof filters.page === 'number') {
    params.page = filters.page;
  }
  if (typeof filters.size === 'number') {
    params.size = filters.size;
  }

  const response = await apiClient.get<ApiResponse<PageResponseDto<ProductSummaryDto>>>(
    '/seller/products',
    { params },
  );
  return unwrapData(response);
}

/**
 * GET /seller/products/{id}
 * Fetch detail of a product owned by the authenticated seller (including unlisted products).
 */
export async function getSellerProductById(productId: string): Promise<ProductDetailDto> {
  const response = await apiClient.get<ApiResponse<ProductDetailDto>>(
    `/seller/products/${productId}`,
  );
  return unwrapData(response);
}

/**
 * POST /seller/products
 * Create a new product for the authenticated seller.
 */
export async function createSellerProduct(
  payload: ProductCreateRequest,
): Promise<ProductDetailDto> {
  const response = await apiClient.post<ApiResponse<ProductDetailDto>>(
    '/seller/products',
    payload,
  );
  return unwrapData(response);
}

/**
 * PATCH /seller/products/{id}
 * Partially update product details.
 * NOTE: The backend does not process `stock` through this endpoint; stock is updated
 * separately via `updateSellerProductStock`.
 */
export async function updateSellerProduct(
  productId: string,
  payload: ProductUpdateRequest,
): Promise<ProductDetailDto> {
  const response = await apiClient.patch<ApiResponse<ProductDetailDto>>(
    `/seller/products/${productId}`,
    payload,
  );
  return unwrapData(response);
}

/**
 * PATCH /seller/products/{id}/stock
 * Set the absolute stock inventory level for a seller's product.
 */
export async function updateSellerProductStock(
  productId: string,
  stock: number | StockUpdateRequest,
): Promise<ProductDetailDto> {
  const body: StockUpdateRequest = typeof stock === 'number' ? { stock } : stock;
  const response = await apiClient.patch<ApiResponse<ProductDetailDto>>(
    `/seller/products/${productId}/stock`,
    body,
  );
  return unwrapData(response);
}

/**
 * DELETE /seller/products/{id}
 * Soft-delete / unlist a product (`active = false`).
 *
 * Backend responds with 204 No Content and an empty response body.
 * Handled safely to avoid parsing errors on empty bodies.
 */
export async function deleteSellerProduct(productId: string): Promise<void> {
  const response = await apiClient.delete<ApiResponse<null>>(`/seller/products/${productId}`);

  // 204 No Content carries an empty body; do not pass empty body to unwrap helpers
  if (response.status === 204 || response.data == null) {
    return;
  }
  unwrapVoid(response);
}
