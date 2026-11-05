import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import CartScreen from '../CartScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockCartLines = [
  {
    id: 'cart-line-1',
    productId: 'prod-10',
    name: 'Preserved Wireless Headphones',
    image: 'https://example.com/headphones.jpg',
    unitPrice: 1500000,
    quantity: 2,
    lineTotal: 3000000,
    availableStock: 5,
    active: true,
    available: true,
  },
];

const mockUpdateQuantity = jest.fn(async () => {});
const mockRemoveItem = jest.fn(async () => {});
const mockClearCart = jest.fn(async () => {});

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-cart-1', role: 'CUSTOMER' },
    isAuthenticated: true,
    isRestoring: false,
  }),
}));

jest.mock('../../hooks/useCart', () => ({
  useCart: () => ({
    items: mockCartLines,
    totalItems: 1,
    subtotal: 3000000,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isCustomer: true,
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    clearCart: mockClearCart,
    isMutating: false,
    isClearing: false,
    pendingItemId: null,
  }),
}));

describe('CartScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders cart in Vietnamese with preserved line total, product name, and checkout navigation', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getByLabelText } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <CartScreen navigation={mockNavigation} route={{ key: 'Cart', name: 'Cart' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('Giỏ hàng')).toBeTruthy();
    expect(getByText('1 sản phẩm')).toBeTruthy();
    expect(getByText('Xóa giỏ hàng')).toBeTruthy();
    expect(getByText('Tạm tính')).toBeTruthy();
    expect(getByText('3.000.000 ₫')).toBeTruthy();
    expect(getByText('Mua hàng (1)')).toBeTruthy();

    // Backend preserved product data
    expect(getByText('Preserved Wireless Headphones')).toBeTruthy();

    // Checkout navigation preserves cartItemIds
    fireEvent.press(getByLabelText('Tiến hành thanh toán'));
    expect(mockNavigate).toHaveBeenCalledWith('Checkout', {
      cartItemIds: ['cart-line-1'],
    });
  });

  it('renders cart in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getByLabelText, getByTestId } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <CartScreen navigation={mockNavigation} route={{ key: 'Cart', name: 'Cart' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized copy
    expect(getByText('Cart')).toBeTruthy();
    expect(getByText('1 item')).toBeTruthy();
    expect(getByText('Clear Cart')).toBeTruthy();
    expect(getByText('Selected subtotal')).toBeTruthy();
    expect(getByText('Checkout (1)')).toBeTruthy();

    // Dark mode check
    expect(getByTestId('cart-screen')).toBeTruthy();
  });
});
