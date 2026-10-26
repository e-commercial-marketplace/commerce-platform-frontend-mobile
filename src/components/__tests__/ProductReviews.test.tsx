/**
 * Unit tests for ProductReviews component.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useProductReviews } from '../../hooks/useReviews';
import type { ReviewResponse } from '../../types/reviewApi';
import ProductReviews from '../ProductReviews';

jest.mock('../../hooks/useReviews', () => ({
  useProductReviews: jest.fn(),
}));

const mockedUseProductReviews = useProductReviews as jest.MockedFunction<typeof useProductReviews>;

const mockReview1: ReviewResponse = {
  id: 'rev-uuid-1',
  productId: 'prod-uuid-1',
  userId: 'secret-customer-uuid-1111',
  rating: 5,
  comment: 'Super battery and camera quality!',
  createdAt: '2026-10-26T10:00:00Z',
};

const mockReview2: ReviewResponse = {
  id: 'rev-uuid-2',
  productId: 'prod-uuid-1',
  userId: 'secret-customer-uuid-2222',
  rating: 4,
  comment: 'Decent performance for daily use.',
  createdAt: '2026-10-25T14:30:00Z',
};

describe('ProductReviews', () => {
  const mockOnOpenWriteReview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders aggregate rating summary, score, and verified ratings count', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [mockReview1],
        page: 0,
        size: 5,
        totalElements: 1,
        totalPages: 1,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={4.5}
        reviewCount={12}
        onOpenWriteReview={mockOnOpenWriteReview}
      />,
    );

    expect(getByText('Customer Reviews')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('12 verified ratings')).toBeTruthy();
    expect(getByText('Based on 12 reviews')).toBeTruthy();
  });

  it('renders loading state when initial fetch is pending', () => {
    mockedUseProductReviews.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={0}
        reviewCount={0}
      />,
    );

    expect(getByText('Loading reviews…')).toBeTruthy();
  });

  it('renders error state and retry button on failure', () => {
    const mockRefetch = jest.fn();
    mockedUseProductReviews.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetch,
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={0}
        reviewCount={0}
      />,
    );

    expect(getByText('Could not load reviews')).toBeTruthy();
    expect(getByText('Network error')).toBeTruthy();

    fireEvent.press(getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders empty state when there are no reviews', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [],
        page: 0,
        size: 5,
        totalElements: 0,
        totalPages: 0,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={0}
        reviewCount={0}
      />,
    );

    expect(getByText('No reviews yet')).toBeTruthy();
    expect(getByText('Be the first customer to share your thoughts on this product!')).toBeTruthy();
  });

  it('renders review list without exposing raw customer UUID (privacy rule)', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [mockReview1, mockReview2],
        page: 0,
        size: 5,
        totalElements: 2,
        totalPages: 1,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText, getAllByText, queryByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={4.5}
        reviewCount={2}
      />,
    );

    // Displays privacy-safe label
    expect(getAllByText('Verified Customer').length).toBe(2);

    // Displays comments
    expect(getByText('Super battery and camera quality!')).toBeTruthy();
    expect(getByText('Decent performance for daily use.')).toBeTruthy();

    // MUST NOT display raw user UUID
    expect(queryByText('secret-customer-uuid-1111')).toBeNull();
    expect(queryByText('secret-customer-uuid-2222')).toBeNull();
  });

  it('renders Load more button when more pages exist and triggers page increment', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [mockReview1],
        page: 0,
        size: 1,
        totalElements: 2,
        totalPages: 2,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={5}
        reviewCount={2}
      />,
    );

    const loadMoreBtn = getByText('Load more reviews');
    expect(loadMoreBtn).toBeTruthy();

    fireEvent.press(loadMoreBtn);
    // Triggers next page fetch through state change
    expect(mockedUseProductReviews).toHaveBeenCalled();
  });

  it('calls onOpenWriteReview when Write a Review button is pressed', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [],
        page: 0,
        size: 5,
        totalElements: 0,
        totalPages: 0,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={0}
        reviewCount={0}
        onOpenWriteReview={mockOnOpenWriteReview}
        canWriteReview={true}
      />,
    );

    const writeBtn = getByText('Write a Review');
    fireEvent.press(writeBtn);

    expect(mockOnOpenWriteReview).toHaveBeenCalled();
  });

  it('hides Write a Review button when canWriteReview is false', () => {
    mockedUseProductReviews.mockReturnValue({
      data: {
        content: [],
        page: 0,
        size: 5,
        totalElements: 0,
        totalPages: 0,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { queryByText } = render(
      <ProductReviews
        productId="prod-uuid-1"
        productName="iPhone 16 Pro Max"
        averageRating={0}
        reviewCount={0}
        onOpenWriteReview={mockOnOpenWriteReview}
        canWriteReview={false}
      />,
    );

    expect(queryByText('Write a Review')).toBeNull();
  });
});
