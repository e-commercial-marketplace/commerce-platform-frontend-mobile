/**
 * Product API service - thin wrappers over backend endpoints.
 *
 * Uses the shared `apiClient` (so the base URL, the Bearer header and the
 * 401/refresh behavior all come from the existing API layer) and the shared
 * `unwrapData` helper, which turns the backend's `ApiResponse` envelope into
 * the payload or throws a typed `ApiError`.
 *
 * Contract verified against the backend source:
 * - GET /products        -> ApiResponse<PageResponse<ProductSummaryResponse>>
 * - GET /products/{id}   -> ApiResponse<ProductResponse>
 * - GET /categories      -> ApiResponse<List<CategorySummaryResponse>>
 */

import { apiClient, unwrapData } from '../api/client';
import type { ProductListFilters } from '../api/queryKeys';
import type { ApiResponse } from '../types/api';
import type {
  CategorySummaryDto,
  PageResponseDto,
  ProductDetailDto,
  ProductSummaryDto,
} from '../types/productApi';

export async function getProducts(
  filters: ProductListFilters = {},
): Promise<PageResponseDto<ProductSummaryDto>> {
  const params: Record<string, string | number> = {};

  if (filters.q != null && filters.q.trim().length > 0) {
    params.q = filters.q.trim();
  }
  if (filters.categoryId != null) {
    params.categoryId = filters.categoryId;
  }
  if (filters.sellerId != null) {
    params.sellerId = filters.sellerId;
  }
  if (filters.minPrice != null) {
    params.minPrice = filters.minPrice;
  }
  if (filters.maxPrice != null) {
    params.maxPrice = filters.maxPrice;
  }
  if (filters.minRating != null) {
    params.minRating = filters.minRating;
  }
  if (filters.sort != null) {
    params.sort = filters.sort;
  }
  if (filters.page != null) {
    params.page = filters.page;
  }
  if (filters.size != null) {
    params.size = filters.size;
  }

  const response = await apiClient.get<ApiResponse<PageResponseDto<ProductSummaryDto>>>('/products', {
    params,
  });
  return unwrapData(response);
}

export async function getProductById(id: string): Promise<ProductDetailDto> {
  const response = await apiClient.get<ApiResponse<ProductDetailDto>>(`/products/${id}`);
  return unwrapData(response);
}

export async function getCategories(): Promise<CategorySummaryDto[]> {
  const response = await apiClient.get<ApiResponse<CategorySummaryDto[]>>('/categories');
  return unwrapData(response);
}
