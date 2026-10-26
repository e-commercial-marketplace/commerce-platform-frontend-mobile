/**
 * Unit tests for WriteReviewModal.
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { useCreateReview } from '../../hooks/useReviews';
import WriteReviewModal from '../WriteReviewModal';

jest.mock('../../hooks/useReviews', () => ({
  useCreateReview: jest.fn(),
}));

const mockedUseCreateReview = useCreateReview as jest.MockedFunction<typeof useCreateReview>;

describe('WriteReviewModal', () => {
  const mockMutateAsync = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedUseCreateReview.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
  });

  it('renders modal with product name and interactive star selector', () => {
    const { getByText, getByLabelText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    expect(getByText('Write a Review')).toBeTruthy();
    expect(getByText('iPhone 16 Pro Max')).toBeTruthy();
    expect(getByText('5 / 5')).toBeTruthy();
    expect(getByLabelText('Rate 4 stars')).toBeTruthy();
  });

  it('allows selecting different star ratings', () => {
    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    fireEvent.press(getByLabelText('Rate 3 stars'));
    expect(getByText('3 / 5')).toBeTruthy();
  });

  it('tracks character count for comment input', () => {
    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    const input = getByLabelText('Review comment input');
    fireEvent.changeText(input, 'Great battery life!');

    expect(getByText('19/2000')).toBeTruthy();
  });

  it('prevents submission when comment is empty or whitespace only', () => {
    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    const input = getByLabelText('Review comment input');
    fireEvent.changeText(input, '   ');

    const submitBtn = getByText('Submit Review');
    fireEvent.press(submitBtn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('submits review successfully, resets form, and alerts user', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: 'rev-1',
      productId: 'p-1',
      userId: 'u-1',
      rating: 4,
      comment: 'Super fast delivery and great quality',
      createdAt: '2026-10-26T10:00:00Z',
    });

    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    fireEvent.press(getByLabelText('Rate 4 stars'));
    fireEvent.changeText(getByLabelText('Review comment input'), 'Super fast delivery and great quality');

    fireEvent.press(getByText('Submit Review'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        productId: 'p-1',
        data: {
          rating: 4,
          comment: 'Super fast delivery and great quality',
        },
      });
      expect(Alert.alert).toHaveBeenCalledWith('Review Submitted', 'Thank you for your feedback!');
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays friendly message when customer is not eligible (REVIEW_NOT_ELIGIBLE)', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('Not eligible', 'REVIEW_NOT_ELIGIBLE', 403),
    );

    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    fireEvent.changeText(getByLabelText('Review comment input'), 'Nice phone');
    fireEvent.press(getByText('Submit Review'));

    await waitFor(() => {
      expect(getByText('You can review this product after completing an order for it.')).toBeTruthy();
    });
  });

  it('displays friendly message when customer already reviewed (REVIEW_ALREADY_EXISTS)', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('Already reviewed', 'REVIEW_ALREADY_EXISTS', 409),
    );

    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    fireEvent.changeText(getByLabelText('Review comment input'), 'Nice phone');
    fireEvent.press(getByText('Submit Review'));

    await waitFor(() => {
      expect(getByText('You have already reviewed this product.')).toBeTruthy();
    });
  });

  it('calls onClose when close icon or cancel button is pressed', () => {
    const { getByLabelText, getByText } = render(
      <WriteReviewModal
        visible={true}
        productId="p-1"
        productName="iPhone 16 Pro Max"
        onClose={mockOnClose}
      />,
    );

    fireEvent.press(getByLabelText('Close review dialog'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
