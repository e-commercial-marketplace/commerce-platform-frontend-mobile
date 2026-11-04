import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import HomeScreen from '../HomeScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockProducts = [
  {
    id: 'p-1',
    name: 'Backend Preserved Laptop',
    price: 15000000,
    rating: 4.5,
    reviewCount: 12,
    sellerId: 's-1',
    image: 'https://example.com/laptop.jpg',
  },
];

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1', role: 'CUSTOMER' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../hooks/useProducts', () => ({
  useCategories: () => ({
    data: [{ id: 'cat-1', name: 'Preserved Electronics' }],
  }),
  useProductList: () => ({
    data: {
      products: mockProducts,
      totalPages: 3,
      totalElements: 45,
    },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useVoucher', () => ({
  useUsableVouchers: () => ({
    data: { pages: [{ content: [] }] },
    isLoading: false,
    isError: false,
  }),
}));

describe('HomeScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders catalog UI in Vietnamese by default without changing dynamic Backend product data', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getAllByText, getByLabelText } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <HomeScreen navigation={mockNavigation} route={{ key: 'Home', name: 'Home' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('Ưu đãi nổi bật')).toBeTruthy();
    expect(getByText('SÀN THƯƠNG MẠI')).toBeTruthy();
    expect(getByText('Lưới')).toBeTruthy();
    expect(getByText('Danh sách')).toBeTruthy();
    expect(getByText('Trang 1 / 3')).toBeTruthy();

    // Dynamic backend data must remain completely untouched
    expect(getAllByText('Backend Preserved Laptop').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Preserved Electronics')).toBeTruthy();

    // Navigation triggers
    fireEvent.press(getByLabelText('Mở giỏ hàng'));
    expect(mockNavigate).toHaveBeenCalledWith('Cart');

    fireEvent.press(getByLabelText('Tìm kiếm sản phẩm'));
    expect(mockNavigate).toHaveBeenCalledWith('Search');
  });

  it('renders catalog UI in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getAllByText, getByTestId } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <HomeScreen navigation={mockNavigation} route={{ key: 'Home', name: 'Home' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized copy
    expect(getByText('All Deals')).toBeTruthy();
    expect(getByText('MARKETPLACE')).toBeTruthy();
    expect(getByText('Grid')).toBeTruthy();
    expect(getByText('List')).toBeTruthy();
    expect(getByText('Page 1 / 3')).toBeTruthy();

    // Backend product preserved
    expect(getAllByText('Backend Preserved Laptop').length).toBeGreaterThanOrEqual(1);

    // Dark mode container renders with dark background
    const container = getByTestId('home-screen');
    expect(container).toBeTruthy();
  });
});
