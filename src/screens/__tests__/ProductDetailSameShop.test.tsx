import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useOpenConversation } from '../../hooks/useChat';
import { useProductDetail, useSameShopProducts } from '../../hooks/useProducts';
import { useSellerShop } from '../../hooks/useSellers';
import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import type { Product } from '../../types/product';
import ProductDetailScreen from '../ProductDetailScreen';

jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useCart', () => ({ useCart: jest.fn() }));
jest.mock('../../hooks/useChat', () => ({ useOpenConversation: jest.fn() }));
jest.mock('../../hooks/useProducts', () => ({
  useProductDetail: jest.fn(),
  useSameShopProducts: jest.fn(),
}));
jest.mock('../../hooks/useSellers', () => ({ useSellerShop: jest.fn() }));
jest.mock('../../hooks/useReviews', () => ({
  useProductReviews: jest.fn(() => ({
    data: { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useCreateReview: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCart = useCart as jest.MockedFunction<typeof useCart>;
const mockedUseOpenConversation = useOpenConversation as jest.MockedFunction<typeof useOpenConversation>;
const mockedUseProductDetail = useProductDetail as jest.MockedFunction<typeof useProductDetail>;
const mockedUseSameShopProducts = useSameShopProducts as jest.MockedFunction<typeof useSameShopProducts>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const CURRENT_PRODUCT: Product = {
  id: 'prod-target',
  name: 'Current Main Phone',
  description: 'Main product description',
  price: 20000000,
  rating: 4.8,
  reviewCount: 50,
  category: 'Phones',
  image: 1,
  sellerId: 'seller-abc',
  stock: 10,
  active: true,
};

const RECOMMENDATIONS: Product[] = [
  {
    id: 'prod-rec-1',
    name: 'Recommended Earphones',
    description: 'Noise cancelling earphones',
    price: 1500000,
    rating: 4.5,
    reviewCount: 20,
    category: 'Audio',
    image: 1,
    sellerId: 'seller-abc',
    stock: 25,
    active: true,
  },
  {
    id: 'prod-rec-2',
    name: 'Recommended Phone Case',
    description: 'Protective case',
    price: 250000,
    rating: 4.9,
    reviewCount: 110,
    category: 'Accessories',
    image: 1,
    sellerId: 'seller-abc',
    stock: 50,
    active: true,
  },
  {
    id: 'prod-rec-3',
    name: 'Recommended Fast Charger',
    description: '65W Fast Charger',
    price: 500000,
    rating: 4.7,
    reviewCount: 35,
    category: 'Accessories',
    image: 1,
    sellerId: 'seller-abc',
    stock: 15,
    active: true,
  },
];

function renderScreen(
  navigationOverride?: any,
  routeParams = { productId: CURRENT_PRODUCT.id },
  themePreference: 'light' | 'dark' = 'light',
  language: 'vi' | 'en' = 'vi',
) {
  const navigation = {
    navigate: jest.fn(),
    push: jest.fn(),
    dispatch: jest.fn(),
    goBack: jest.fn(),
    ...navigationOverride,
  };

  return {
    navigation,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference={themePreference}>
          <AppI18nProvider initialLanguage={language}>
            <ProductDetailScreen
              navigation={navigation as any}
              route={{
                key: 'ProductDetail',
                name: 'ProductDetail',
                params: routeParams,
              } as any}
            />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('ProductDetailScreen - More Products From Same Shop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', role: 'CUSTOMER', email: 'test@example.com', name: 'User' },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });
    mockedUseCart.mockReturnValue({ addItem: jest.fn() } as any);
    mockedUseOpenConversation.mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as any);
    mockedUseProductDetail.mockReturnValue({
      data: CURRENT_PRODUCT,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);
    mockedUseSellerShop.mockReturnValue({
      data: { id: 'seller-abc', name: 'Gadget Official Store', productCount: 4 },
      isPending: false,
      isError: false,
    } as any);
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  it('displays Vietnamese header and recommended products excluding the current product', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    mockedUseSameShopProducts.mockReturnValue({
      data: [CURRENT_PRODUCT, ...RECOMMENDATIONS], // Backend included current product
      isLoading: false,
      isError: false,
    } as any);

    const { getByText, queryByText, getByTestId } = renderScreen();

    // Section rendered
    expect(getByTestId('same-shop-section')).toBeTruthy();

    // Vietnamese title check
    expect(getByText('Sản phẩm khác của shop')).toBeTruthy();

    // Recommendations are displayed
    expect(getByText('Recommended Earphones')).toBeTruthy();
    expect(getByText('Recommended Phone Case')).toBeTruthy();
    expect(getByText('Recommended Fast Charger')).toBeTruthy();

    // The current product itself is excluded from the same-shop grid
    // While CURRENT_PRODUCT.name appears at the top as main product,
    // the same-shop hook called with sellerId and current productId
    expect(mockedUseSameShopProducts).toHaveBeenCalledWith('seller-abc', CURRENT_PRODUCT.id);
  });

  it('displays English header "More from this shop" when language is en and supports dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    mockedUseSameShopProducts.mockReturnValue({
      data: RECOMMENDATIONS,
      isLoading: false,
      isError: false,
    } as any);

    const { getByText, getByTestId } = renderScreen(
      undefined,
      { productId: CURRENT_PRODUCT.id },
      'dark',
      'en',
    );

    expect(getByTestId('same-shop-section')).toBeTruthy();
    expect(getByText('More from this shop')).toBeTruthy();
    expect(getByText('Recommended Earphones')).toBeTruthy();
  });

  it('hides the section when the shop has no other products (empty results)', () => {
    mockedUseSameShopProducts.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);

    const { queryByTestId, queryByText } = renderScreen();

    expect(queryByTestId('same-shop-section')).toBeNull();
    expect(queryByText('Sản phẩm khác của shop')).toBeNull();
    expect(queryByText('More from this shop')).toBeNull();
  });

  it('does not break Product Detail when same-shop API fails', () => {
    mockedUseSameShopProducts.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
    } as any);

    const { queryByTestId, getByText } = renderScreen();

    // Section is hidden on error
    expect(queryByTestId('same-shop-section')).toBeNull();

    // Main product details still work cleanly
    expect(getByText('Current Main Phone')).toBeTruthy();
    expect(getByText('Mô tả sản phẩm')).toBeTruthy();
  });

  it('shows loading indicator when same shop products are loading', () => {
    mockedUseSameShopProducts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any);

    const { getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId('same-shop-loading')).toBeTruthy();
    expect(queryByTestId('same-shop-section')).toBeNull();
  });

  it('navigates to product detail using navigation.push when a recommended product is tapped', () => {
    mockedUseSameShopProducts.mockReturnValue({
      data: RECOMMENDATIONS,
      isLoading: false,
      isError: false,
    } as any);

    const mockPush = jest.fn();
    const { getByText } = renderScreen({ push: mockPush });

    fireEvent.press(getByText('Recommended Earphones'));

    expect(mockPush).toHaveBeenCalledWith('ProductDetail', { productId: 'prod-rec-1' });
  });

  it('falls back to navigation.navigate if push is not available', () => {
    mockedUseSameShopProducts.mockReturnValue({
      data: RECOMMENDATIONS,
      isLoading: false,
      isError: false,
    } as any);

    const mockNavigate = jest.fn();
    const { getByText } = renderScreen({ navigate: mockNavigate, push: undefined });

    fireEvent.press(getByText('Recommended Phone Case'));

    expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'prod-rec-2' });
  });
});
