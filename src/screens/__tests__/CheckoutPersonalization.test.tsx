import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import CheckoutScreen from '../CheckoutScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockCartLine = {
  id: 'cart-line-checkout-1',
  productId: 'prod-mon-1',
  name: 'Preserved 4K Monitor',
  image: 'https://example.com/monitor.jpg',
  unitPrice: 5000000,
  quantity: 1,
  lineTotal: 5000000,
  availableStock: 10,
  active: true,
  available: true,
};

const mockPlaceOrder = jest.fn();
const mockValidateVoucher = jest.fn();

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'cust-1', role: 'CUSTOMER' },
    isAuthenticated: true,
    isRestoring: false,
  }),
}));

jest.mock('../../hooks/useCart', () => ({
  useCart: () => ({
    items: [mockCartLine],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isCustomer: true,
  }),
}));

jest.mock('../../hooks/useCheckout', () => ({
  useCheckout: () => ({
    placeOrder: mockPlaceOrder,
    isPending: false,
  }),
}));

jest.mock('../../hooks/useVoucher', () => ({
  useValidateVoucher: () => ({
    mutateAsync: mockValidateVoucher,
    isPending: false,
  }),
  useUsableVouchers: () => ({
    data: { pages: [{ content: [] }] },
    isLoading: false,
    isError: false,
  }),
}));

describe('CheckoutScreen Personalization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders checkout UI in Vietnamese by default with preserved backend product name and localized validation', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getAllByText, getByRole, getByPlaceholderText, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference="light">
          <AppI18nProvider initialLanguage="vi">
            <CheckoutScreen
              navigation={mockNavigation}
              route={{
                key: 'Checkout',
                name: 'Checkout',
                params: { cartItemIds: ['cart-line-checkout-1'] },
              }}
            />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('XEM LẠI ĐƠN HÀNG')).toBeTruthy();
    expect(getByText('Thanh toán')).toBeTruthy();
    expect(getByText('Sản phẩm đã chọn')).toBeTruthy();
    expect(getAllByText('Địa chỉ nhận hàng').length).toBeGreaterThanOrEqual(1);
    expect(getByPlaceholderText('Nhập số nhà, tên đường, quận/huyện, tỉnh/thành phố…')).toBeTruthy();
    expect(getByText('Phương thức thanh toán')).toBeTruthy();
    expect(getByText('Thanh toán khi nhận hàng (COD)')).toBeTruthy();
    expect(getByText('VNPay')).toBeTruthy();
    expect(getByText('Mã giảm giá sàn')).toBeTruthy();
    expect(getByText('Chi tiết thanh toán')).toBeTruthy();
    expect(getByText('Tiền hàng')).toBeTruthy();
    expect(getByText('Phí vận chuyển')).toBeTruthy();
    expect(getByText('Giảm giá')).toBeTruthy();
    expect(getByText('Tổng tạm tính')).toBeTruthy();
    expect(getByRole('button', { name: 'Đặt hàng' })).toBeTruthy();

    // Backend data preserved
    expect(getByText('Preserved 4K Monitor')).toBeTruthy();
    expect(getByText('1 × 5.000.000 ₫')).toBeTruthy();
    expect(getAllByText('5.000.000 ₫').length).toBeGreaterThanOrEqual(1);

    // Trigger validation error on empty address
    fireEvent.press(getByRole('button', { name: 'Đặt hàng' }));
    expect(getByText('Vui lòng nhập địa chỉ nhận hàng.')).toBeTruthy();
    expect(mockPlaceOrder).not.toHaveBeenCalled();

    // Switch payment method to VNPay
    fireEvent.press(getByRole('radio', { name: 'VNPay' }));
    expect(getByRole('button', { name: 'Thanh toán qua VNPay' })).toBeTruthy();
  });

  it('renders checkout UI in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getAllByText, getByTestId, getByRole, getByPlaceholderText } = render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference="dark">
          <AppI18nProvider initialLanguage="en">
            <CheckoutScreen
              navigation={mockNavigation}
              route={{
                key: 'Checkout',
                name: 'Checkout',
                params: { cartItemIds: ['cart-line-checkout-1'] },
              }}
            />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );

    // English localized copy
    expect(getByText('ORDER REVIEW')).toBeTruthy();
    expect(getByText('Checkout')).toBeTruthy();
    expect(getByText('Selected items')).toBeTruthy();
    expect(getAllByText('Shipping address').length).toBeGreaterThanOrEqual(1);
    expect(getByPlaceholderText('Street, city, province…')).toBeTruthy();
    expect(getByText('Payment method')).toBeTruthy();
    expect(getByText('Cash on Delivery (COD)')).toBeTruthy();
    expect(getByText('VNPay')).toBeTruthy();
    expect(getByText('Platform voucher')).toBeTruthy();
    expect(getByText('Order summary')).toBeTruthy();
    expect(getByText('Items subtotal')).toBeTruthy();
    expect(getByText('Shipping fee')).toBeTruthy();
    expect(getByText('Discount')).toBeTruthy();
    expect(getByText('Estimated total')).toBeTruthy();
    expect(getByRole('button', { name: 'Place Order' })).toBeTruthy();

    // Dark mode screen testID check
    expect(getByTestId('checkout-screen')).toBeTruthy();

    // Trigger validation error in English
    fireEvent.press(getByRole('button', { name: 'Place Order' }));
    expect(getByText('Shipping address is required.')).toBeTruthy();
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });
});
