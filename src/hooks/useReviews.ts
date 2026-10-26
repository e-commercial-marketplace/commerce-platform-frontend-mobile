/**
 * TanStack Query hooks for product reviews & ratings.
 *
 * Hooks:
 * - `useProductReviews`: public paginated list of reviews for a product.
 * - `useCreateReview`: creates a review for an eligible completed purchase,
 *   invalidating product reviews, product detail, and product catalog lists.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { createReview, getProductReviews } from '../services/reviewService';
import type { ReviewCreateRequest, ReviewResponse } from '../types/reviewApi';

/** Default reviews page size. */
export const REVIEWS_PAGE_SIZE = 20;

/**
 * Fetch paginated reviews for a specific product.
 */
export function useProductReviews(
  productId: string,
  page = 0,
  size = REVIEWS_PAGE_SIZE,
  enabled = true,
) {
  return useQuery({
    queryKey: [...queryKeys.reviews.byProduct(productId), page, size],
    queryFn: () => getProductReviews(productId, page, size),
    enabled: enabled && productId.length > 0,
  });
}

/**
 * Create a review for a completed purchase line.
 * Automatically invalidates relevant caches upon success so reviews and rating
 * aggregates update immediately across the app.
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: ReviewCreateRequest }) =>
      createReview(productId, data),
    onSuccess: (createdReview: ReviewResponse, { productId }) => {
      // 1. Refetch reviews for this product so the new review appears
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(productId) });
      // 2. Refetch product detail to refresh ratingAverage and reviewCount
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(productId) });
      // 3. Invalidate catalog listings so cards display updated rating/count
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      return createdReview;
    },
  });
}
