/**
 * TanStack Query hooks for Seller Product Management.
 *
 * Implements queries and mutations for seller product lifecycle:
 * - Queries:
 *   - `useSellerProducts`: filtered/paginated list of products owned by seller
 *   - `useSellerProduct`: single product detail
 * - Mutations:
 *   - `useCreateSellerProduct`: creates a new product
 *   - `useUpdateSellerProduct`: updates non-stock product fields
 *   - `useUpdateSellerProductStock`: updates absolute inventory level
 *   - `useDeleteSellerProduct`: soft-deletes/unlists product
 *
 * Cache Invalidation rules:
 * - Create: invalidates sellerProducts.all, products.all, sellers.all
 * - Update: invalidates sellerProducts.all, sellerProducts.detail(id), products.all, sellers.all
 * - Stock update: invalidates sellerProducts.all, sellerProducts.detail(id), products.all
 * - Delete: invalidates sellerProducts.all, sellerProducts.detail(id), products.all, sellers.all
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProductById,
  getSellerProducts,
  updateSellerProduct,
  updateSellerProductStock,
} from '../services/sellerProductService';
import type {
  ProductCreateRequest,
  ProductUpdateRequest,
  SellerProductListFilters,
  StockUpdateRequest,
} from '../types/sellerProductApi';

/**
 * Hook to fetch paginated/filtered list of seller-owned products.
 */
export function useSellerProducts(
  filters: SellerProductListFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.sellerProducts.list(filters),
    queryFn: () => getSellerProducts(filters),
    enabled,
  });
}

/**
 * Hook to fetch a single seller product detail by its ID.
 * Disabled if productId is not provided or empty.
 */
export function useSellerProduct(
  productId: string | undefined,
  enabled = true,
) {
  const hasId = productId != null && productId.trim().length > 0;
  return useQuery({
    queryKey: queryKeys.sellerProducts.detail(productId ?? ''),
    queryFn: () => {
      if (!hasId) {
        throw new Error('A product id is required.');
      }
      return getSellerProductById(productId!);
    },
    enabled: enabled && hasId,
  });
}

/**
 * Mutation to create a new product.
 * Invalidates seller products, public catalog, and public shop queries on success.
 */
export function useCreateSellerProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProductCreateRequest) => createSellerProduct(payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProducts.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellers.all });
      return data;
    },
  });
}

/**
 * Mutation to update product details.
 * Invalidates seller products (list + detail), public catalog, and public shop queries on success.
 */
export function useUpdateSellerProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductUpdateRequest }) =>
      updateSellerProduct(id, payload),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProducts.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerProducts.detail(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellers.all });
      return data;
    },
  });
}

/**
 * Mutation to update product stock quantity.
 * Invalidates seller products (list + detail) and public catalog on success.
 */
export function useUpdateSellerProductStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number | StockUpdateRequest }) =>
      updateSellerProductStock(id, stock),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProducts.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerProducts.detail(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      return data;
    },
  });
}

/**
 * Mutation to soft-delete / unlist a product.
 * Invalidates seller products (list + detail), public catalog, and public shop queries on success.
 */
export function useDeleteSellerProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => deleteSellerProduct(productId),
    onSuccess: (_data, productId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProducts.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sellerProducts.detail(productId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellers.all });
    },
  });
}
