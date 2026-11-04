import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { getProducts } from '../../services/productService';
import type { PageResponseDto, ProductSummaryDto } from '../../types/productApi';
import { useSameShopProducts } from '../useProducts';

jest.mock('../../services/productService', () => ({
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  getCategories: jest.fn(),
}));

const mockedGetProducts = getProducts as jest.MockedFunction<typeof getProducts>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeSummaryDto(
  id: string,
  name: string,
  active = true,
  sellerId = 'seller-1',
): ProductSummaryDto {
  return {
    id,
    name,
    description: `Desc ${id}`,
    imageUrl: 'https://example.com/p.jpg',
    price: '150000.00',
    stock: 5,
    ratingAverage: '4.8',
    reviewCount: 12,
    active,
    category: { id: 'cat-1', name: 'Electronics' },
    sellerId,
  };
}

describe('useSameShopProducts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches products from seller with size 10, filters out current product and inactive products, and caps at 8', async () => {
    const rawProducts: ProductSummaryDto[] = [
      makeSummaryDto('curr-prod', 'Current Product'),
      makeSummaryDto('p-1', 'Product 1', true),
      makeSummaryDto('p-2', 'Product 2', false),
      makeSummaryDto('p-3', 'Product 3', true),
      makeSummaryDto('p-4', 'Product 4', true),
      makeSummaryDto('p-5', 'Product 5', true),
      makeSummaryDto('p-6', 'Product 6', true),
      makeSummaryDto('p-7', 'Product 7', true),
      makeSummaryDto('p-8', 'Product 8', true),
      makeSummaryDto('p-9', 'Product 9', true),
      makeSummaryDto('p-10', 'Product 10', true),
    ];

    const pageResponse: PageResponseDto<ProductSummaryDto> = {
      content: rawProducts,
      page: 0,
      size: 10,
      totalElements: 11,
      totalPages: 2,
    };

    mockedGetProducts.mockResolvedValueOnce(pageResponse);

    const client = makeClient();
    const { result } = renderHook(() => useSameShopProducts('seller-1', 'curr-prod'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetProducts).toHaveBeenCalledWith({ sellerId: 'seller-1', page: 0, size: 10 });
    expect(result.current.data).toHaveLength(8);
    expect(result.current.data?.some((p) => p.id === 'curr-prod')).toBe(false);
    expect(result.current.data?.some((p) => p.id === 'p-2')).toBe(false);
    expect(result.current.data?.[0].id).toBe('p-1');
  });

  it('is disabled when sellerId or currentProductId is missing', () => {
    const client = makeClient();
    const { result } = renderHook(() => useSameShopProducts(undefined, 'curr-prod'), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetProducts).not.toHaveBeenCalled();
  });

  it('deduplicates products by id if backend response contains duplicates', async () => {
    const rawProducts: ProductSummaryDto[] = [
      makeSummaryDto('p-1', 'Product 1', true),
      makeSummaryDto('p-1', 'Product 1 Dup', true),
      makeSummaryDto('p-2', 'Product 2', true),
    ];

    mockedGetProducts.mockResolvedValueOnce({
      content: rawProducts,
      page: 0,
      size: 10,
      totalElements: 3,
      totalPages: 1,
    });

    const client = makeClient();
    const { result } = renderHook(() => useSameShopProducts('seller-1', 'curr-prod'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((p) => p.id)).toEqual(['p-1', 'p-2']);
  });
});
