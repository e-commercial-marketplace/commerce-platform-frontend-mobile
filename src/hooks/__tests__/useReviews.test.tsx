/**
 * Unit tests for review TanStack Query hooks.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import { createReview, getProductReviews } from '../../services/reviewService';
import type { ReviewResponse } from '../../types/reviewApi';
import { useCreateReview, useProductReviews } from '../useReviews';

jest.mock('../../services/reviewService', () => ({
  getProductReviews: jest.fn(),
  createReview: jest.fn(),
}));

const mockedGetProductReviews = getProductReviews as jest.MockedFunction<typeof getProductReviews>;
const mockedCreateReview = createReview as jest.MockedFunction<typeof createReview>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mockReview: ReviewResponse = {
  id: 'rev-1',
  productId: 'prod-1',
  userId: 'user-1',
  rating: 5,
  comment: 'Great phone!',
  createdAt: '2026-10-26T10:00:00Z',
};

describe('useReviews hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useProductReviews', () => {
    it('fetches reviews for a given product', async () => {
      const client = makeClient();
      mockedGetProductReviews.mockResolvedValueOnce({
        content: [mockReview],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      });

      const { result } = renderHook(() => useProductReviews('prod-1', 0, 20), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.content).toEqual([mockReview]);
      expect(mockedGetProductReviews).toHaveBeenCalledWith('prod-1', 0, 20);
    });

    it('does not execute when productId is empty', () => {
      const client = makeClient();
      renderHook(() => useProductReviews('', 0, 20), {
        wrapper: wrapper(client),
      });

      expect(mockedGetProductReviews).not.toHaveBeenCalled();
    });
  });

  describe('useCreateReview', () => {
    it('creates review and invalidates reviews, product detail, and product catalog queries', async () => {
      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      mockedCreateReview.mockResolvedValueOnce(mockReview);

      const { result } = renderHook(() => useCreateReview(), {
        wrapper: wrapper(client),
      });

      await result.current.mutateAsync({
        productId: 'prod-1',
        data: {
          rating: 5,
          comment: 'Great phone!',
        },
      });

      expect(mockedCreateReview).toHaveBeenCalledWith('prod-1', {
        rating: 5,
        comment: 'Great phone!',
      });

      // Assert query invalidations
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.reviews.byProduct('prod-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.detail('prod-1'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
    });
  });
});
