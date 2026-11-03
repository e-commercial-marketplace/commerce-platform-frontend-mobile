import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import ProductDetailScreen from '../ProductDetailScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  dispatch: jest.fn(),
  goBack: jest.fn(),
} as never;

const mockProduct = {
  id: 'prod-detail-1',
  name: 'Preserved Flagship Camera',
  description: 'Authoritative description from server.',
  price: 25000000,
  originalPrice: 30000000,
  rating: 4.9,
  reviewCount: 42,
  stock: 10,
  sellerId: 'seller-42',
  image: 'https://example.com/cam.jpg',
  active: true,
};

const mockAddItem = jest.fn(async () => {});

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', role: 'CUSTOMER' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../hooks/useProducts', () => ({
  useProductDetail: () => ({
    data: mockProduct,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useSellers', () => ({
  useSellerShop: () => ({
    data: { id: 'seller-42', name: 'Preserved Camera Store' },
  }),
}));

jest.mock('../../hooks/useCart', () => ({
  useCart: () => ({
    addItem: mockAddItem,
    isPending: false,
    items: [],
  }),
}));

jest.mock('../../hooks/useChat', () => ({
  useOpenConversation: () => ({
    openConversation: jest.fn(),
    isPending: false,
  }),
}));

const EMPTY_REVIEWS = { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 };
jest.mock('../../hooks/useReviews', () => ({
  useProductReviews: jest.fn(() => ({
    data: EMPTY_REVIEWS,
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

describe('ProductDetailScreen Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders product details in Vietnamese with preserved backend product name, description, and seller name', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, getByRole, getByLabelText, unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference="light">
          <AppI18nProvider initialLanguage="vi">
            <ProductDetailScreen
              navigation={mockNavigation}
              route={{ key: 'ProductDetail', name: 'ProductDetail', params: { productId: 'prod-detail-1' } }}
            />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );

    // Vietnamese localized labels
    expect(getByText('Số lượng')).toBeTruthy();
    expect(getByText('Mô tả sản phẩm')).toBeTruthy();
    expect(getByText('Thêm vào giỏ hàng')).toBeTruthy();
    expect(getByText('Mua ngay')).toBeTruthy();
    expect(getByText('Bán bởi')).toBeTruthy();
    expect(getByText('Nhắn tin với shop')).toBeTruthy();
    expect(getByLabelText('Xem shop Preserved Camera Store')).toBeTruthy();

    // Backend data preserved
    expect(getByText('Preserved Flagship Camera')).toBeTruthy();
    expect(getByText('Authoritative description from server.')).toBeTruthy();
    expect(getByText('Preserved Camera Store')).toBeTruthy();

    // Add to cart mutation
    fireEvent.press(getByText('Thêm vào giỏ hàng'));
    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalledWith('prod-detail-1', 1);
    });
    unmount();
  });

  it('renders product details in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText, getByTestId, getByLabelText, unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference="dark">
          <AppI18nProvider initialLanguage="en">
            <ProductDetailScreen
              navigation={mockNavigation}
              route={{ key: 'ProductDetail', name: 'ProductDetail', params: { productId: 'prod-detail-1' } }}
            />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>,
    );

    // English localized labels
    expect(getByText('Quantity')).toBeTruthy();
    expect(getByText('Description')).toBeTruthy();
    expect(getByText('Add to Cart')).toBeTruthy();
    expect(getByText('Buy Now')).toBeTruthy();
    expect(getByText('Sold by')).toBeTruthy();
    expect(getByText('Chat with shop')).toBeTruthy();
    expect(getByLabelText('View shop Preserved Camera Store')).toBeTruthy();

    // Dark mode screen testID check
    expect(getByTestId('product-detail-screen')).toBeTruthy();
    unmount();
  });
});
