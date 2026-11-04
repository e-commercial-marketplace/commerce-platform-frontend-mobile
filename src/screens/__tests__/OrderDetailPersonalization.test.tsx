import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import OrderDetailScreen from '../OrderDetailScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider } from '../../i18n';
import { useOrderDetail, useConfirmReceived } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { useSellerShop } from '../../hooks/useSellers';
import { useOpenConversation } from '../../hooks/useChat';
import type { OrderResponse } from '../../types/orderApi';

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
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseOpenConversation = useOpenConversation as jest.MockedFunction<typeof useOpenConversation>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

const mockOrder: OrderResponse = {
  id: 'order-detail-test-123',
  status: 'DELIVERED',
  paymentStatus: 'COMPLETED',
  paymentMethod: 'VNPAY',
  paymentUrl: null,
  createdAt: '2026-10-26T10:00:00Z',
  shippingAddress: '456 Le Loi, District 1, HCMC',
  shippingFee: '25000.00',
  discountAmount: '5000.00',
  totalAmount: '450000.00',
  voucherCode: 'SAVE5K',
  shipments: [],
  items: [
    {
      id: 'item-1',
      orderId: 'order-detail-test-123',
      productId: 'prod-1',
      productName: 'Mechanical Keyboard RGB',
      unitPrice: '430000.00',
      quantity: 1,
      status: 'CONFIRMED',
      sellerId: 'seller-1',
    },
  ],
};

function renderScreen(language: 'vi' | 'en' = 'vi', preference: 'light' | 'dark' = 'light') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  };

  const mockRoute: any = {
    key: 'OrderDetail-test',
    name: 'OrderDetail',
    params: { orderId: 'order-detail-test-123' },
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <OrderDetailScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('OrderDetailScreen Personalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseOrderDetail.mockReturnValue({
      data: mockOrder,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    mockedUseConfirmReceived.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as any);

    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@test.com', role: 'CUSTOMER' } as any,
      token: 'jwt-token-123',
      isAuthenticated: true,
      isInitialized: true,
      logout: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
    } as any);

    mockedUseOpenConversation.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseSellerShop.mockReturnValue({
      data: { id: 'seller-1', name: 'Tech Store' } as any,
      isLoading: false,
      isError: false,
    } as any);
  });

  it('renders localized Vietnamese strings and theme tokens correctly', () => {
    const { getByText, getByTestId } = renderScreen('vi', 'dark');

    // Section headings & labels in Vietnamese
    expect(getByText('Đơn hàng')).toBeTruthy();
    expect(getByText('Mã đơn hàng')).toBeTruthy();
    expect(getByText('Thanh toán')).toBeTruthy();
    expect(getByText('Phương thức')).toBeTruthy();
    expect(getByText('Địa chỉ nhận hàng')).toBeTruthy();
    expect(getByText('Sản phẩm')).toBeTruthy();
    expect(getByText('Tổng thanh toán')).toBeTruthy();
    expect(getByText('Đã giao hàng')).toBeTruthy();
    expect(getByText('Đã thanh toán')).toBeTruthy();
    expect(getByText('Đã nhận được hàng')).toBeTruthy();

    // Raw non-translatable fields
    expect(getByText('order-detail-test-123')).toBeTruthy();
    expect(getByText('Mechanical Keyboard RGB')).toBeTruthy();
    expect(getByText('456 Le Loi, District 1, HCMC')).toBeTruthy();

    // Dark background test
    const container = getByTestId('order-detail-screen');
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#121212' })])
    );
  });

  it('renders localized English strings correctly in light mode', () => {
    const { getByText, getByTestId } = renderScreen('en', 'light');

    expect(getByText('Order')).toBeTruthy();
    expect(getByText('Order ID')).toBeTruthy();
    expect(getByText('Payment')).toBeTruthy();
    expect(getByText('Method')).toBeTruthy();
    expect(getByText('Delivery Address')).toBeTruthy();
    expect(getByText('Items')).toBeTruthy();
    expect(getByText('Totals')).toBeTruthy();
    expect(getByText('Delivered')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    expect(getByText('Confirm Received')).toBeTruthy();

    const container = getByTestId('order-detail-screen');
    expect(container.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FFFFFF' })])
    );
  });
});
