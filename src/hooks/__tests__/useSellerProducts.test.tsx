/**
 * Unit tests for useSellerProducts hooks.
 *
 * Verifies query execution, filter forwarding, enabled gating,
 * mutation execution, and cache invalidation matrices.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProductById,
  getSellerProducts,
  updateSellerProduct,
  updateSellerProductStock,
} from '../../services/sellerProductService';
import type {
  PageResponseDto,
  ProductCreateRequest,
  ProductDetailDto,
  ProductSummaryDto,
  ProductUpdateRequest,
  SellerProductListFilters,
} from '../../types/sellerProductApi';
import {
  useCreateSellerProduct,
  useDeleteSellerProduct,
  useSellerProduct,
  useSellerProducts,
  useUpdateSellerProduct,
  useUpdateSellerProductStock,
} from '../useSellerProducts';

jest.mock('../../services/sellerProductService', () => ({
  getSellerProducts: jest.fn(),
  getSellerProductById: jest.fn(),
  createSellerProduct: jest.fn(),
  updateSellerProduct: jest.fn(),
  updateSellerProductStock: jest.fn(),
  deleteSellerProduct: jest.fn(),
}));

const mockedGetSellerProducts = getSellerProducts as jest.MockedFunction<
  typeof getSellerProducts
>;
const mockedGetSellerProductById = getSellerProductById as jest.MockedFunction<
  typeof getSellerProductById
>;
const mockedCreateSellerProduct = createSellerProduct as jest.MockedFunction<
  typeof createSellerProduct
>;
const mockedUpdateSellerProduct = updateSellerProduct as jest.MockedFunction<
  typeof updateSellerProduct
>;
const mockedUpdateSellerProductStock = updateSellerProductStock as jest.MockedFunction<
  typeof updateSellerProductStock
>;
const mockedDeleteSellerProduct = deleteSellerProduct as jest.MockedFunction<
  typeof deleteSellerProduct
>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mockProduct: ProductDetailDto = {
  id: 'prod-uuid-1',
  name: 'iPad Pro 11 inch',
  description: 'M4 chip, Ultra Retina XDR',
  imageUrl: 'https://example.com/ipad.png',
  price: '24990000.00',
  stock: 15,
  ratingAverage: '0',
  reviewCount: 0,
  active: true,
  category: {
    id: 'cat-uuid-1',
    name: 'Tablets',
  },
  sellerId: 'seller-uuid-1',
};

const mockPage: PageResponseDto<ProductSummaryDto> = {
  content: [mockProduct],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('useSellerProducts hooks', () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = makeClient();
  });

  describe('useSellerProducts', () => {
    it('fetches products with default filters and returns data', async () => {
      mockedGetSellerProducts.mockResolvedValueOnce(mockPage);

      const { result } = renderHook(() => useSellerProducts(), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedGetSellerProducts).toHaveBeenCalledWith({});
      expect(result.current.data).toEqual(mockPage);
    });

    it('forwards custom filters to service', async () => {
      mockedGetSellerProducts.mockResolvedValueOnce(mockPage);

      const filters: SellerProductListFilters = {
        q: 'iPad',
        active: false,
        page: 1,
        size: 10,
      };

      const { result } = renderHook(() => useSellerProducts(filters), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedGetSellerProducts).toHaveBeenCalledWith(filters);
    });

    it('respects enabled=false and does not execute query', async () => {
      const { result } = renderHook(() => useSellerProducts({}, false), {
        wrapper: createWrapper(client),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedGetSellerProducts).not.toHaveBeenCalled();
    });
  });

  describe('useSellerProduct', () => {
    it('fetches single product by ID when ID is provided', async () => {
      mockedGetSellerProductById.mockResolvedValueOnce(mockProduct);

      const { result } = renderHook(() => useSellerProduct('prod-uuid-1'), {
        wrapper: createWrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedGetSellerProductById).toHaveBeenCalledWith('prod-uuid-1');
      expect(result.current.data).toEqual(mockProduct);
    });

    it('stays disabled when productId is undefined or empty', () => {
      const { result: resUndefined } = renderHook(() => useSellerProduct(undefined), {
        wrapper: createWrapper(client),
      });
      expect(resUndefined.current.fetchStatus).toBe('idle');
      expect(mockedGetSellerProductById).not.toHaveBeenCalled();

      const { result: resEmpty } = renderHook(() => useSellerProduct('   '), {
        wrapper: createWrapper(client),
      });
      expect(resEmpty.current.fetchStatus).toBe('idle');
      expect(mockedGetSellerProductById).not.toHaveBeenCalled();
    });

    it('respects enabled=false even when productId is present', () => {
      const { result } = renderHook(() => useSellerProduct('prod-uuid-1', false), {
        wrapper: createWrapper(client),
      });
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedGetSellerProductById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateSellerProduct', () => {
    it('calls service and invalidates sellerProducts, products, and sellers caches', async () => {
      mockedCreateSellerProduct.mockResolvedValueOnce(mockProduct);
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useCreateSellerProduct(), {
        wrapper: createWrapper(client),
      });

      const payload: ProductCreateRequest = {
        name: 'New Item',
        price: '100000',
        stock: 5,
        categoryId: 'cat-1',
      };

      await result.current.mutateAsync(payload);

      expect(mockedCreateSellerProduct).toHaveBeenCalledWith(payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellers.all,
      });
    });
  });

  describe('useUpdateSellerProduct', () => {
    it('calls service with id and payload and invalidates list, detail, products, sellers', async () => {
      const updated: ProductDetailDto = { ...mockProduct, name: 'Renamed Item' };
      mockedUpdateSellerProduct.mockResolvedValueOnce(updated);
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSellerProduct(), {
        wrapper: createWrapper(client),
      });

      const payload: ProductUpdateRequest = { name: 'Renamed Item' };

      await result.current.mutateAsync({ id: 'prod-uuid-1', payload });

      expect(mockedUpdateSellerProduct).toHaveBeenCalledWith('prod-uuid-1', payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.detail('prod-uuid-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellers.all,
      });
    });
  });

  describe('useUpdateSellerProductStock', () => {
    it('calls service with id and stock and invalidates sellerProducts, detail, and products', async () => {
      const updated: ProductDetailDto = { ...mockProduct, stock: 40 };
      mockedUpdateSellerProductStock.mockResolvedValueOnce(updated);
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSellerProductStock(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync({ id: 'prod-uuid-1', stock: 40 });

      expect(mockedUpdateSellerProductStock).toHaveBeenCalledWith('prod-uuid-1', 40);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.detail('prod-uuid-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
    });
  });

  describe('useDeleteSellerProduct', () => {
    it('calls service with id and invalidates sellerProducts, detail, products, and sellers', async () => {
      mockedDeleteSellerProduct.mockResolvedValueOnce();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteSellerProduct(), {
        wrapper: createWrapper(client),
      });

      await result.current.mutateAsync('prod-uuid-1');

      expect(mockedDeleteSellerProduct).toHaveBeenCalledWith('prod-uuid-1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.detail('prod-uuid-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellers.all,
      });
    });
  });
});
