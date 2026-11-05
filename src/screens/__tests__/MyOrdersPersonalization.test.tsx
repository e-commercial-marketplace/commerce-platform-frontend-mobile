import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import MyOrdersScreen from '../MyOrdersScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockOrders = [
  {
    id: 'ord-12345678-abcd',
    orderNumber: 'ORD-1234',
    createdAt: '2026-10-15T10:30:00Z',
    status: 'DELIVERED',
    paymentMethod: 'COD',
    paymentStatus: 'COMPLETED',
    totalAmount: '450000.00',
    itemCount: 2,
  },
];

jest.mock('../../hooks/useOrders', () => ({
  useOrders: () => ({
    data: {
      pages: [{ content: mockOrders, pageNumber: 0, totalPages: 1 }],
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

describe('MyOrdersScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders order list in Vietnamese by default with localized labels and navigation', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getByRole } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <MyOrdersScreen
            navigation={mockNavigation}
            route={{ key: 'MyOrders', name: 'MyOrders' }}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('Đơn hàng #ord-1234')).toBeTruthy();
    expect(getByText('Đã giao hàng')).toBeTruthy();
    expect(getByText('Thanh toán')).toBeTruthy();
    expect(getByText('Thanh toán khi nhận hàng (COD) • Đã thanh toán')).toBeTruthy();
    expect(getByText('Ngày đặt')).toBeTruthy();
    expect(getByText('Tổng thanh toán')).toBeTruthy();
    expect(getByText('450.000 ₫')).toBeTruthy();

    // Navigation on press
    fireEvent.press(getByRole('button', { name: 'Đơn hàng #ord-1234' }));
    expect(mockNavigate).toHaveBeenCalledWith('OrderDetail', { orderId: 'ord-12345678-abcd' });
  });

  it('renders order list in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getByTestId } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <MyOrdersScreen
            navigation={mockNavigation}
            route={{ key: 'MyOrders', name: 'MyOrders' }}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized copy
    expect(getByText('Order #ord-1234')).toBeTruthy();
    expect(getByText('Delivered')).toBeTruthy();
    expect(getByText('Payment')).toBeTruthy();
    expect(getByText('Cash on Delivery (COD) • Completed')).toBeTruthy();
    expect(getByText('Created')).toBeTruthy();
    expect(getByText('Total')).toBeTruthy();
    expect(getByText('450.000 ₫')).toBeTruthy();

    // Dark mode root container
    expect(getByTestId('my-orders-screen')).toBeTruthy();
  });
});
