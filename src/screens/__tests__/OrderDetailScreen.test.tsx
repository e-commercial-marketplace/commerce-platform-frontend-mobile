/**
 * Unit tests for OrderDetailScreen reviews and confirmation behavior.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useConfirmReceived, useOrderDetail } from '../../hooks/useOrders';
import { useCreateReview } from '../../hooks/useReviews';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { OrderResponse } from '../../types/orderApi';
import OrderDetailScreen from '../OrderDetailScreen';

jest.mock('../../hooks/useOrders', () => ({
  useOrderDetail: jest.fn(),
  useConfirmReceived: jest.fn(),
}));

jest.mock('../../hooks/useReviews', () => ({
  useCreateReview: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

const mockedUseOrderDetail = useOrderDetail as jest.MockedFunction<typeof useOrderDetail>;
const mockedUseConfirmReceived = useConfirmReceived as jest.MockedFunction<typeof useConfirmReceived>;

type Navigation = AppNavigatorScreenProps<'OrderDetail'>['navigation'];

const baseOrder: OrderResponse = {
  id: 'order-uuid-1',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  paymentUrl: null,
  createdAt: '2026-10-26T10:00:00Z',
  shippingAddress: '123 Nguyen Hue, District 1, HCMC',
  shippingFee: '30000.00',
  discountAmount: '0.00',
  totalAmount: '35000000.00',
  voucherCode: null,
  shipments: [],
  items: [
    {
      id: 'item-uuid-1',
      orderId: 'order-uuid-1',
      productId: 'prod-uuid-iphone',
      productName: 'iPhone 16 Pro Max 256GB',
      unitPrice: '34970000.00',
      quantity: 1,
      status: 'CONFIRMED',
      sellerId: 'seller-uuid-1',
    },
    {
      id: 'item-uuid-2',
      orderId: 'order-uuid-1',
      productId: 'prod-uuid-case',
      productName: 'Silicone Case',
      unitPrice: '500000.00',
      quantity: 1,
      status: 'CANCELLED',
      sellerId: 'seller-uuid-1',
    },
  ],
};

describe('OrderDetailScreen', () => {
  const mockNavigation: Partial<Navigation> = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseConfirmReceived.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
  });

  it('does NOT show review action when order is PENDING', () => {
    mockedUseOrderDetail.mockReturnValue({
      data: { ...baseOrder, status: 'PENDING' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const { queryByText } = render(
      <OrderDetailScreen
        route={{ key: 'OrderDetail', name: 'OrderDetail', params: { orderId: 'order-uuid-1' } }}
        navigation={mockNavigation as Navigation}
      />,
    );

    expect(queryByText('Write Review')).toBeNull();
    expect(queryByText('Confirm Received')).toBeNull();
  });

  it('shows Confirm Received button but NO review action when order is DELIVERED', () => {
    mockedUseOrderDetail.mockReturnValue({
      data: { ...baseOrder, status: 'DELIVERED' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const { getByText, queryByText } = render(
      <OrderDetailScreen
        route={{ key: 'OrderDetail', name: 'OrderDetail', params: { orderId: 'order-uuid-1' } }}
        navigation={mockNavigation as Navigation}
      />,
    );

    expect(getByText('Confirm Received')).toBeTruthy();
    expect(queryByText('Write Review')).toBeNull();
  });

  it('shows Write Review action on eligible items when order is COMPLETED', () => {
    mockedUseOrderDetail.mockReturnValue({
      data: { ...baseOrder, status: 'COMPLETED' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const { getByText, getAllByText, queryByText, getByLabelText } = render(
      <OrderDetailScreen
        route={{ key: 'OrderDetail', name: 'OrderDetail', params: { orderId: 'order-uuid-1' } }}
        navigation={mockNavigation as Navigation}
      />,
    );

    // Confirm Received must remain hidden when COMPLETED
    expect(queryByText('Confirm Received')).toBeNull();

    // Eligible item (CONFIRMED) shows review action
    expect(getByLabelText('Write review for iPhone 16 Pro Max 256GB')).toBeTruthy();

    // CANCELLED item must NOT have Write Review button
    expect(queryByText('Write review for Silicone Case')).toBeNull();
    expect(getAllByText('Write Review').length).toBe(1);
  });

  it('opens WriteReviewModal with the correct product when review action is tapped', () => {
    mockedUseOrderDetail.mockReturnValue({
      data: { ...baseOrder, status: 'COMPLETED' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const { getByLabelText, getByText, getAllByText } = render(
      <OrderDetailScreen
        route={{ key: 'OrderDetail', name: 'OrderDetail', params: { orderId: 'order-uuid-1' } }}
        navigation={mockNavigation as Navigation}
      />,
    );

    fireEvent.press(getByLabelText('Write review for iPhone 16 Pro Max 256GB'));

    // Modal dialog is opened with product details
    expect(getByText('Write a Review')).toBeTruthy();
    expect(getAllByText('iPhone 16 Pro Max 256GB').length).toBeGreaterThanOrEqual(2);
    expect(getByText('Submit Review')).toBeTruthy();
  });
});
