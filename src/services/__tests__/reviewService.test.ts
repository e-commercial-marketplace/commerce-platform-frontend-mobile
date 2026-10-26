/**
 * Unit tests for product review service.
 */

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { ReviewCreateRequest, ReviewResponse } from '../../types/reviewApi';
import { createReview, getProductReviews } from '../reviewService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const mockReview: ReviewResponse = {
  id: 'rev-1',
  productId: 'prod-1',
  userId: 'user-1',
  rating: 5,
  comment: 'Excellent product!',
  createdAt: '2026-10-26T10:00:00Z',
};

describe('reviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProductReviews', () => {
    it('calls GET /products/{productId}/reviews with correct query params and unwraps data', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            content: [mockReview],
            page: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
          },
        },
        status: 200,
      } as any);

      const result = await getProductReviews('prod-1', 0, 20);

      expect(mockedClient.get).toHaveBeenCalledWith('/products/prod-1/reviews', {
        params: { page: 0, size: 20 },
      });
      expect(result.content).toEqual([mockReview]);
      expect(result.totalElements).toBe(1);
    });

    it('throws ApiError when backend returns an error envelope', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Product not found',
          },
        },
        status: 404,
      } as any);

      await expect(getProductReviews('prod-missing', 0, 20)).rejects.toThrow(ApiError);
    });
  });

  describe('createReview', () => {
    const payload: ReviewCreateRequest = {
      rating: 5,
      comment: 'Excellent product!',
    };

    it('calls POST /products/{productId}/reviews with payload and unwraps response', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockReview,
        },
        status: 201,
      } as any);

      const result = await createReview('prod-1', payload);

      expect(mockedClient.post).toHaveBeenCalledWith('/products/prod-1/reviews', payload);
      expect(result).toEqual(mockReview);
    });

    it('throws ApiError when customer is not eligible (REVIEW_NOT_ELIGIBLE)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'REVIEW_NOT_ELIGIBLE',
            message: 'You can review this product after a completed order',
          },
        },
        status: 403,
      } as any);

      await expect(createReview('prod-1', payload)).rejects.toThrow(ApiError);
    });
  });
});
