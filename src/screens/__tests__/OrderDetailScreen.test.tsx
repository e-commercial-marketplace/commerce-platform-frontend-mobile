/**
 * Unit tests for OrderDetailScreen:
 * - Reviews and confirmation behavior
 * - VNPay payment status indicators and banners
 * - Pay Now eligibility (predicates, 24h expiration, statuses)
 * - Pay Now retry mutation (single execution, double-tap guard)
 * - WebBrowser session flow, scheme, redirect parsing, query cache invalidations
 * - Error handling (409 ORDER_NOT_PAYABLE, missing URL, browser crashes)
 * - Bounded recheck on return
 * - COD non-regression
 */

import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { ApiError } from '../../api/errors';
import { useAuth } from '../../hooks/useAuth';
import { useOpenConversation } from '../../hooks/useChat';
import { useConfirmReceived, useOrderDetail } from '../../hooks/useOrders';
import { useSellerShop } from '../../hooks/useSellers';
import { useCreateReview } from '../../hooks/useReviews';
import { createVnpayPayment } from '../../services/paymentService';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { OrderResponse } from '../../types/orderApi';
import type { VnpayPaymentResponse } from '../../types/paymentApi';
import OrderDetailScreen, { isPaymentExpired, isPayNowEligible } from '../OrderDetailScreen';

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

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../../services/paymentService', () => ({
  createVnpayPayment: jest.fn(),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../hooks/useChat', () => ({
  useOpenConversation: jest.fn(),
}));

jest.mock('../../hooks/useSellers', () => ({
  useSellerShop: jest.fn(),
}));

const mockedUseOrderDetail = useOrderDetail as jest.MockedFunction<typeof useOrderDetail>;
const mockedUseConfirmReceived = useConfirmReceived as jest.MockedFunction<typeof useConfirmReceived>;
const mockedCreateVnpayPayment = createVnpayPayment as jest.MockedFunction<typeof createVnpayPayment>;
const mockedOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.MockedFunction<
  typeof WebBrowser.openAuthSessionAsync
>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseOpenConversation = useOpenConversation as jest.MockedFunction<typeof useOpenConversation>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

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

const vnpayOrder: OrderResponse = {
  ...baseOrder,
  paymentMethod: 'VNPAY',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  createdAt: new Date().toISOString(),
};

const VNPAY_PAYMENT_RESPONSE: VnpayPaymentResponse = {
  paymentId: 'pay-uuid-1',
  orderId: 'order-uuid-1',
  amount: '35000000.00',
  status: 'PENDING',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Token=xyz123',
};

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

describe('OrderDetailScreen', () => {
  const mockNavigation: Partial<Navigation> = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  function renderScreen(
    routeParams: AppNavigatorScreenProps<'OrderDetail'>['route']['params'] = { orderId: 'order-uuid-1' },
    navigation: Navigation = mockNavigation as Navigation,
    queryClient: QueryClient = makeClient(),
  ) {
    return {
      queryClient,
      ...render(
        <QueryClientProvider client={queryClient}>
          <OrderDetailScreen
            route={{ key: 'OrderDetail', name: 'OrderDetail', params: routeParams } as any}
            navigation={navigation}
          />
        </QueryClientProvider>,
      ),
    };
  }

  const mockOpenConversationMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseConfirmReceived.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);
    mockedCreateVnpayPayment.mockReset();
    mockedOpenAuthSessionAsync.mockReset();

    mockedUseAuth.mockReturnValue({
      user: { id: 'cust-uuid-1', role: 'CUSTOMER', email: 'customer@test.com' },
      token: 'jwt-token-123',
      isAuthenticated: true,
      isInitialized: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    } as any);

    mockOpenConversationMutateAsync.mockReset();
    mockedUseOpenConversation.mockReturnValue({
      mutateAsync: mockOpenConversationMutateAsync,
      isPending: false,
    } as any);

    mockedUseSellerShop.mockImplementation((sellerId: string) => ({
      data: sellerId ? { id: sellerId, name: `Official Store ${sellerId}`, productCount: 10 } : undefined,
      isLoading: false,
      isError: false,
    } as any));
  });

  describe('Existing Review & Confirm Received behavior (regression)', () => {
    it('does NOT show review action when order is PENDING', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...baseOrder, status: 'PENDING' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByText } = renderScreen();

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

      const { getByText, queryByText } = renderScreen();

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

      const { getByLabelText, getAllByText, queryByText } = renderScreen();

      expect(queryByText('Confirm Received')).toBeNull();
      expect(getByLabelText('Write review for iPhone 16 Pro Max 256GB')).toBeTruthy();
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

      const { getByLabelText, getByText, getAllByText } = renderScreen();

      fireEvent.press(getByLabelText('Write review for iPhone 16 Pro Max 256GB'));

      expect(getByText('Write a Review')).toBeTruthy();
      expect(getAllByText('iPhone 16 Pro Max 256GB').length).toBeGreaterThanOrEqual(2);
      expect(getByText('Submit Review')).toBeTruthy();
    });
  });

  describe('Pay Now eligibility predicates', () => {
    it('evaluates isPaymentExpired correctly', () => {
      expect(isPaymentExpired(null)).toBe(false);
      expect(isPaymentExpired(undefined)).toBe(false);
      expect(isPaymentExpired('invalid-date')).toBe(false);
      expect(isPaymentExpired(new Date().toISOString())).toBe(false);
      expect(isPaymentExpired(new Date(Date.now() - 25 * 3600 * 1000).toISOString())).toBe(true);
    });

    it('evaluates isPayNowEligible correctly', () => {
      expect(isPayNowEligible(vnpayOrder)).toBe(true);
      // COD not eligible
      expect(isPayNowEligible({ ...vnpayOrder, paymentMethod: 'COD' })).toBe(false);
      // COMPLETED payment not eligible
      expect(isPayNowEligible({ ...vnpayOrder, paymentStatus: 'COMPLETED' })).toBe(false);
      // Non-PENDING order status not eligible
      expect(isPayNowEligible({ ...vnpayOrder, status: 'PAID' })).toBe(false);
      expect(isPayNowEligible({ ...vnpayOrder, status: 'DELIVERED' })).toBe(false);
      expect(isPayNowEligible({ ...vnpayOrder, status: 'CANCELLED' })).toBe(false);
      // Expired after 24h not eligible
      expect(
        isPayNowEligible({
          ...vnpayOrder,
          createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
        }),
      ).toBe(false);
    });
  });

  describe('VNPay Payment Status Banners', () => {
    it('shows Pay Now button and Payment Pending banner for eligible PENDING VNPAY order', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByLabelText, getByText } = renderScreen();

      expect(getByLabelText('Pay Now')).toBeTruthy();
      expect(getByText('Payment pending')).toBeTruthy();
      expect(getByText('Please complete payment within 24 hours of placing your order.')).toBeTruthy();
    });

    it('hides Pay Now button for COD orders', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...baseOrder, paymentMethod: 'COD', status: 'PENDING', paymentStatus: 'PENDING' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByLabelText, queryByText } = renderScreen();

      expect(queryByLabelText('Pay Now')).toBeNull();
      expect(queryByText('Payment pending')).toBeNull();
    });

    it('hides Pay Now button when paymentStatus is COMPLETED', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...vnpayOrder, paymentStatus: 'COMPLETED' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByLabelText, getByText } = renderScreen();

      expect(queryByLabelText('Pay Now')).toBeNull();
      expect(getByText('Payment successful')).toBeTruthy();
      expect(getByText('Your payment via VNPay has been confirmed.')).toBeTruthy();
    });

    it('hides Pay Now button when order status is PAID', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...vnpayOrder, status: 'PAID' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByLabelText } = renderScreen();

      expect(queryByLabelText('Pay Now')).toBeNull();
    });

    it('hides Pay Now button and shows expired banner when order is older than 24h', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: {
          ...vnpayOrder,
          createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
        },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByLabelText, getByText } = renderScreen();

      expect(queryByLabelText('Pay Now')).toBeNull();
      expect(getByText('Payment expired')).toBeTruthy();
      expect(getByText(/24-hour payment window has expired/)).toBeTruthy();
    });

    it('renders FAILED payment status correctly', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...vnpayOrder, paymentStatus: 'FAILED' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText, getByLabelText } = renderScreen();

      expect(getByText('Payment not completed')).toBeTruthy();
      expect(getByLabelText('Pay Now')).toBeTruthy();
    });

    it('renders REFUNDED payment status correctly and hides Pay Now', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...vnpayOrder, paymentStatus: 'REFUNDED' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText, queryByLabelText } = renderScreen();

      expect(getByText('Refunded')).toBeTruthy();
      expect(getByText('This payment has been refunded.')).toBeTruthy();
      expect(queryByLabelText('Pay Now')).toBeNull();
    });

    it('shows checking status banner for COMPLETED transient hint while backend is PENDING', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText, queryByText } = renderScreen({
        orderId: 'order-uuid-1',
        paymentHint: 'COMPLETED',
      });

      expect(getByText('Checking payment status…')).toBeTruthy();
      expect(queryByText('Payment successful')).toBeNull();
    });

    it('shows cancelled banner for CANCELLED transient hint while backend is PENDING', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText } = renderScreen({
        orderId: 'order-uuid-1',
        paymentHint: 'CANCELLED',
      });

      expect(getByText('Payment cancelled')).toBeTruthy();
      expect(getByText(/Payment was cancelled. You can retry/)).toBeTruthy();
    });

    it('shows failed banner for FAILED transient hint while backend is PENDING', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText } = renderScreen({
        orderId: 'order-uuid-1',
        paymentHint: 'FAILED',
      });

      expect(getByText('Payment not completed')).toBeTruthy();
      expect(getByText(/VNPay reported that payment was not completed/)).toBeTruthy();
    });

    it('authoritative COMPLETED backend state overrides stale CANCELLED transient hint', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: { ...vnpayOrder, paymentStatus: 'COMPLETED' },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { getByText, queryByText } = renderScreen({
        orderId: 'order-uuid-1',
        paymentHint: 'CANCELLED',
      });

      expect(getByText('Payment successful')).toBeTruthy();
      expect(queryByText('Payment cancelled')).toBeNull();
    });
  });

  describe('Pay Now Retry Flow & Browser Integration', () => {
    it('pressing Pay Now calls retry endpoint and launches WebBrowser session with marketplace:// scheme', async () => {
      mockedCreateVnpayPayment.mockResolvedValue(VNPAY_PAYMENT_RESPONSE);
      mockedOpenAuthSessionAsync.mockResolvedValue({
        type: 'success',
        url: 'marketplace://payment-result?orderId=order-uuid-1&status=COMPLETED',
      } as any);
      const refetchMock = jest.fn().mockResolvedValue({ data: { ...vnpayOrder, paymentStatus: 'COMPLETED' } });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      await waitFor(() => {
        expect(mockedCreateVnpayPayment).toHaveBeenCalledWith('order-uuid-1');
      });

      await waitFor(() => {
        expect(mockedOpenAuthSessionAsync).toHaveBeenCalledWith(
          VNPAY_PAYMENT_RESPONSE.paymentUrl,
          'marketplace://payment-result',
        );
      });

      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled();
      });
    });

    it('handles browser cancel by setting transient hint to CANCELLED and refetching', async () => {
      mockedCreateVnpayPayment.mockResolvedValue(VNPAY_PAYMENT_RESPONSE);
      mockedOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' } as any);
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText, findByText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      expect(await findByText('Payment cancelled')).toBeTruthy();
      expect(refetchMock).toHaveBeenCalled();
    });

    it('handles browser dismiss by setting transient hint to CANCELLED and refetching', async () => {
      mockedCreateVnpayPayment.mockResolvedValue(VNPAY_PAYMENT_RESPONSE);
      mockedOpenAuthSessionAsync.mockResolvedValue({ type: 'dismiss' } as any);
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText, findByText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      expect(await findByText('Payment cancelled')).toBeTruthy();
      expect(refetchMock).toHaveBeenCalled();
    });

    it('handles browser throw/rejection cleanly and refetches order', async () => {
      mockedCreateVnpayPayment.mockResolvedValue(VNPAY_PAYMENT_RESPONSE);
      mockedOpenAuthSessionAsync.mockRejectedValue(new Error('Browser crashed'));
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText, findByText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      expect(await findByText('Failed to open payment browser. Please try again.')).toBeTruthy();
      expect(refetchMock).toHaveBeenCalled();
    });

    it('handles missing retry paymentUrl without launching browser', async () => {
      mockedCreateVnpayPayment.mockResolvedValue({ ...VNPAY_PAYMENT_RESPONSE, paymentUrl: '' });
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText, findByText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      expect(await findByText('Payment URL unavailable. Please try again later.')).toBeTruthy();
      expect(mockedOpenAuthSessionAsync).not.toHaveBeenCalled();
      expect(refetchMock).toHaveBeenCalled();
    });

    it('handles 409 ORDER_NOT_PAYABLE gracefully and refetches order', async () => {
      mockedCreateVnpayPayment.mockRejectedValue(
        new ApiError('This order can no longer be paid.', 'ORDER_NOT_PAYABLE', 409),
      );
      const refetchMock = jest.fn().mockResolvedValue({ data: { ...vnpayOrder, status: 'CANCELLED' } });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText, findByText } = renderScreen();

      fireEvent.press(getByLabelText('Pay Now'));

      expect(await findByText('This order can no longer be paid.')).toBeTruthy();
      expect(mockedOpenAuthSessionAsync).not.toHaveBeenCalled();
      expect(refetchMock).toHaveBeenCalled();
    });

    it('prevents duplicate retry calls on rapid double-tap', async () => {
      let resolveRetry!: (val: VnpayPaymentResponse) => void;
      mockedCreateVnpayPayment.mockReturnValue(
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );
      mockedOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' } as any);
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { getByLabelText } = renderScreen();
      const btn = getByLabelText('Pay Now');

      fireEvent.press(btn);
      fireEvent.press(btn);

      await waitFor(() => {
        expect(mockedCreateVnpayPayment).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        resolveRetry(VNPAY_PAYMENT_RESPONSE);
      });

      await waitFor(() => {
        expect(mockedOpenAuthSessionAsync).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Pull-to-refresh & Bounded Recheck', () => {
    it('allows manual pull-to-refresh to trigger refetch', async () => {
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      const { UNSAFE_getByType } = renderScreen();
      const scrollView = UNSAFE_getByType(ScrollView);

      await act(async () => {
        scrollView.props.refreshControl.props.onRefresh();
      });

      expect(refetchMock).toHaveBeenCalledTimes(1);
    });

    it('schedules a single bounded recheck when mounted with COMPLETED hint but order is still PENDING', () => {
      jest.useFakeTimers();
      const refetchMock = jest.fn().mockResolvedValue({ data: vnpayOrder });
      mockedUseOrderDetail.mockReturnValue({
        data: vnpayOrder,
        isLoading: false,
        isError: false,
        refetch: refetchMock,
      } as any);

      renderScreen({
        orderId: 'order-uuid-1',
        paymentHint: 'COMPLETED',
      });

      expect(refetchMock).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(2600);
      });

      expect(refetchMock).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });
  });

  describe('Human Chat Integration — Contact Seller from Order Detail (Phase 5B)', () => {
    it('allows a Customer to see "Message the shop" and start/open a conversation', async () => {
      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-new-order-1',
        customerId: 'cust-uuid-1',
        sellerId: 'seller-uuid-1',
        productId: null,
        orderId: 'order-uuid-1',
        createdAt: '2026-10-30T10:00:00Z',
        lastMessageAt: null,
      });

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(undefined, mockNav);

      const chatButton = getByText('Message the shop');
      expect(chatButton).toBeTruthy();

      fireEvent.press(chatButton);

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      const payload = mockOpenConversationMutateAsync.mock.calls[0][0];
      // Must use actual sellerId from order
      expect(payload.sellerId).toBe('seller-uuid-1');
      // Must use actual orderId from order
      expect(payload.orderId).toBe('order-uuid-1');
      // Must NOT send customerId
      expect(payload.customerId).toBeUndefined();

      // Must navigate to returned conversation.id
      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-new-order-1',
        counterpartName: 'Official Store seller-uuid-1',
        counterpartRole: 'SELLER',
      });
    });

    it('navigates to ChatRoom when backend returns existing conversation (200 OK)', async () => {
      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      // Existing conversation might not have orderId attached or have previous context
      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-existing-99',
        customerId: 'cust-uuid-1',
        sellerId: 'seller-uuid-1',
        productId: 'prod-uuid-previous',
        orderId: null,
        createdAt: '2026-10-25T10:00:00Z',
        lastMessageAt: '2026-10-29T10:00:00Z',
      });

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(undefined, mockNav);

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      // Must navigate to the real conversation returned without fabricating client-side context
      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-existing-99',
        counterpartName: 'Official Store seller-uuid-1',
        counterpartRole: 'SELLER',
      });
    });

    it('hides "Message the shop" button for SELLER role', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'seller-uuid-1', role: 'SELLER', email: 'seller@test.com' },
        token: 'jwt-token',
        isAuthenticated: true,
      } as any);

      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByText } = renderScreen();
      expect(queryByText('Message the shop')).toBeNull();
    });

    it('hides "Message the shop" button for ADMIN role', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'admin-uuid-1', role: 'ADMIN', email: 'admin@test.com' },
        token: 'jwt-token',
        isAuthenticated: true,
      } as any);

      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByText } = renderScreen();
      expect(queryByText('Message the shop')).toBeNull();
    });

    it('navigates unauthenticated user to Login on chat press if rendered', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        token: null,
        isAuthenticated: false,
      } as any);

      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const { queryByText } = renderScreen();
      // Since isCustomer is false when unauthenticated, button is not rendered
      expect(queryByText('Message the shop')).toBeNull();
    });

    it('supports multi-seller orders with distinct chat action per seller without arbitrary selection', async () => {
      const multiSellerOrder: OrderResponse = {
        ...baseOrder,
        id: 'order-multi-seller-9',
        items: [
          {
            id: 'item-1',
            orderId: 'order-multi-seller-9',
            productId: 'prod-1',
            productName: 'Sony Headphones',
            unitPrice: '5000000.00',
            quantity: 1,
            status: 'CONFIRMED',
            sellerId: 'seller-sony',
          },
          {
            id: 'item-2',
            orderId: 'order-multi-seller-9',
            productId: 'prod-2',
            productName: 'Apple iPad',
            unitPrice: '15000000.00',
            quantity: 1,
            status: 'CONFIRMED',
            sellerId: 'seller-apple',
          },
        ],
      };

      mockedUseOrderDetail.mockReturnValue({
        data: multiSellerOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-apple-order',
        customerId: 'cust-uuid-1',
        sellerId: 'seller-apple',
        productId: null,
        orderId: 'order-multi-seller-9',
        createdAt: '2026-10-30T10:00:00Z',
        lastMessageAt: null,
      });

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getAllByText, getByTestId } = renderScreen({ orderId: 'order-multi-seller-9' }, mockNav);

      const chatButtons = getAllByText('Message the shop');
      expect(chatButtons).toHaveLength(2);

      // Explicitly tap Seller Apple's chat button
      const appleChatButton = getByTestId('chat-seller-seller-apple');
      expect(appleChatButton).toBeTruthy();

      fireEvent.press(appleChatButton);

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      // Verifies frontend selected seller-apple, NOT the first seller (seller-sony)
      const payload = mockOpenConversationMutateAsync.mock.calls[0][0];
      expect(payload.sellerId).toBe('seller-apple');
      expect(payload.orderId).toBe('order-multi-seller-9');

      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-apple-order',
        counterpartName: 'Official Store seller-apple',
        counterpartRole: 'SELLER',
      });
    });

    it('prevents rapid double-tap from creating duplicate openConversation requests', () => {
      mockedUseOpenConversation.mockReturnValue({
        mutateAsync: mockOpenConversationMutateAsync,
        isPending: true,
      } as any);

      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(undefined, mockNav);

      const chatButton = getByText('Message the shop');
      fireEvent.press(chatButton);

      expect(mockOpenConversationMutateAsync).not.toHaveBeenCalled();
      expect(mockNav.navigate).not.toHaveBeenCalled();
    });

    it('displays error and does not navigate when openConversation fails', async () => {
      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      mockOpenConversationMutateAsync.mockRejectedValueOnce(
        new ApiError('Server connection error', 'NETWORK_ERROR', null),
      );

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(undefined, mockNav);

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      expect(mockNav.navigate).not.toHaveBeenCalled();
      expect(getByText('Server connection error')).toBeTruthy();

      // Retry remains possible
      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-retry-success',
        customerId: 'cust-uuid-1',
        sellerId: 'seller-uuid-1',
        productId: null,
        orderId: 'order-uuid-1',
        createdAt: '2026-10-30T10:00:00Z',
        lastMessageAt: null,
      });

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(2);
      });

      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-retry-success',
        counterpartName: 'Official Store seller-uuid-1',
        counterpartRole: 'SELLER',
      });
    });

    it('navigates to SellerShop when shop header is pressed', () => {
      mockedUseOrderDetail.mockReturnValue({
        data: baseOrder,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(undefined, mockNav);

      const shopName = getByText('Official Store seller-uuid-1');
      fireEvent.press(shopName);

      expect(mockNav.navigate).toHaveBeenCalledWith('SellerShop', {
        sellerId: 'seller-uuid-1',
      });
    });
  });
});
