import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import SearchScreen from '../SearchScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockProducts = [
  {
    id: 'p-search-1',
    name: 'Dynamic Search Result Phone',
    price: 8000000,
    rating: 4.6,
    reviewCount: 30,
    sellerId: 's-1',
    image: 'https://example.com/phone.jpg',
  },
];

jest.mock('../../hooks/useProducts', () => ({
  useCategories: () => ({
    data: [{ id: 'c-1', name: 'Smartphones' }],
  }),
  useProductList: () => ({
    data: {
      products: mockProducts,
      totalPages: 1,
      totalElements: 1,
    },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

describe('SearchScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders search discovery UI in Vietnamese by default', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getByPlaceholderText } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <SearchScreen navigation={mockNavigation} route={{ key: 'Search', name: 'Search' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized search headers
    expect(getByText('Tìm kiếm')).toBeTruthy();
    expect(getByText('Tìm kiếm sản phẩm nhanh chóng')).toBeTruthy();
    expect(getByPlaceholderText('Tìm kiếm sản phẩm')).toBeTruthy();
    expect(getByText('Danh mục')).toBeTruthy();
    expect(getByText('Tìm kiếm gần đây')).toBeTruthy();

    // Backend category preserved
    expect(getByText('Smartphones')).toBeTruthy();
  });

  it('renders search discovery UI in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getByPlaceholderText, getByTestId } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <SearchScreen navigation={mockNavigation} route={{ key: 'Search', name: 'Search' }} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized search headers
    expect(getByText('Search')).toBeTruthy();
    expect(getByText('Find products quickly')).toBeTruthy();
    expect(getByPlaceholderText('Search for product')).toBeTruthy();
    expect(getByText('Categories')).toBeTruthy();
    expect(getByText('Recent searches')).toBeTruthy();

    // Dark mode testID check
    expect(getByTestId('search-screen')).toBeTruthy();
  });
});
