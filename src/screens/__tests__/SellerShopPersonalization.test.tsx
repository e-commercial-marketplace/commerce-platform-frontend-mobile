import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import SellerShopScreen from '../SellerShopScreen';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockShop = {
  id: 'seller-test-1',
  name: 'Preserved Authentic Store',
  productCount: 20,
};

const mockProducts = [
  {
    id: 'p-shop-item-1',
    name: 'Preserved Shop Item A',
    price: 350000,
    rating: 4.8,
    reviewCount: 15,
    sellerId: 'seller-test-1',
    image: 'https://example.com/item.jpg',
  },
];

jest.mock('../../hooks/useSellers', () => ({
  useSellerShop: () => ({
    data: mockShop,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useProducts', () => ({
  useProductList: () => ({
    data: {
      products: mockProducts,
      totalPages: 2,
      totalElements: 20,
    },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'cust-1', role: 'CUSTOMER' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../hooks/useChat', () => ({
  useOpenConversation: () => ({
    openConversation: jest.fn(),
    isPending: false,
  }),
}));

describe('SellerShopScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders seller shop in Vietnamese with preserved shop name and product name', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <SellerShopScreen
            navigation={mockNavigation}
            route={{ key: 'SellerShop', name: 'SellerShop', params: { sellerId: 'seller-test-1' } }}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('20 sản phẩm đang bán')).toBeTruthy();
    expect(getByText('Nhắn tin với shop')).toBeTruthy();
    expect(getByText('Sản phẩm')).toBeTruthy();
    expect(getByText('Trước')).toBeTruthy();
    expect(getByText('Sau')).toBeTruthy();

    // Backend data preserved
    expect(getByText('Preserved Authentic Store')).toBeTruthy();
    expect(getByText('Preserved Shop Item A')).toBeTruthy();
  });

  it('renders seller shop in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getByTestId } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <SellerShopScreen
            navigation={mockNavigation}
            route={{ key: 'SellerShop', name: 'SellerShop', params: { sellerId: 'seller-test-1' } }}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized copy
    expect(getByText('20 products for sale')).toBeTruthy();
    expect(getByText('Chat with shop')).toBeTruthy();
    expect(getByText('Products')).toBeTruthy();
    expect(getByText('Previous')).toBeTruthy();
    expect(getByText('Next')).toBeTruthy();

    // Backend data preserved
    expect(getByText('Preserved Authentic Store')).toBeTruthy();
  });
});
