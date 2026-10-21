/**
 * TanStack Query hooks for the public catalog (products + categories).
 *
 * They reuse the foundation exactly as-is: the single app-wide `QueryClient`
 * (src/api/queryClient.ts) and the key factory (src/api/queryKeys.ts). No
 * second client and no inline key literals are introduced here.
 *
 * The hooks only translate between the backend wire format and the UI model;
 * all caching, retry and invalidation rules stay in the shared client.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys, type ProductListFilters } from '../api/queryKeys';
import { getCategories, getProductById, getProducts } from '../services/productService';
import type { PageResponseDto, ProductSummaryDto } from '../types/productApi';
import { mapProductDetailToProduct, mapProductSummaryToProduct } from '../utils/productMapper';

/** A product page, already mapped to the UI model. */
export type ProductListResult = {
  products: ReturnType<typeof mapProductSummaryToProduct>[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * Paginated catalog list. The filters object is part of the query key, so
 * every combination of search/category/page is cached separately.
 */
export function useProductList(filters: ProductListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => getProducts(filters),
    select: (data: PageResponseDto<ProductSummaryDto>): ProductListResult => ({
      products: data.content.map(mapProductSummaryToProduct),
      page: data.page,
      size: data.size,
      totalElements: data.totalElements,
      totalPages: data.totalPages,
    }),
  });
}

/** A single product. Disabled when there is no id to request. */
export function useProductDetail(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProductById(productId),
    enabled: productId.length > 0,
    select: (data) => mapProductDetailToProduct(data),
  });
}

/** All categories (public, rarely changes). */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: getCategories,
  });
}
