import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SellerProductsScreen from '../SellerProductsScreen';
import SellerProductFormScreen from '../SellerProductFormScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import {
  useDeleteSellerProduct,
  useSellerProducts,
  useUpdateSellerProduct,
  useUpdateSellerProductStock,
  useCreateSellerProduct,
  useSellerProduct,
} from '../../hooks/useSellerProducts';
import { useCategories } from '../../hooks/useProducts';
import type { ProductSummaryDto } from '../../types/sellerProductApi';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useSellerProducts');
jest.mock('../../hooks/useProducts');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseSellerProducts = useSellerProducts as jest.MockedFunction<typeof useSellerProducts>;
const mockedUseUpdateSellerProduct = useUpdateSellerProduct as jest.MockedFunction<typeof useUpdateSellerProduct>;
const mockedUseUpdateSellerProductStock = useUpdateSellerProductStock as jest.MockedFunction<typeof useUpdateSellerProductStock>;
const mockedUseDeleteSellerProduct = useDeleteSellerProduct as jest.MockedFunction<typeof useDeleteSellerProduct>;
const mockedUseCreateSellerProduct = useCreateSellerProduct as jest.MockedFunction<typeof useCreateSellerProduct>;
const mockedUseSellerProduct = useSellerProduct as jest.MockedFunction<typeof useSellerProduct>;
const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;

const mockProduct: ProductSummaryDto = {
  id: 'seller-prod-1',
  name: 'Mechanical Gaming Keyboard TKL',
  description: 'Custom mechanical keyboard',
  imageUrl: 'https://example.com/keyboard.jpg',
  price: '1850000.00',
  stock: 25,
  ratingAverage: '4.9',
  reviewCount: 30,
  active: true,
  category: { id: 'cat-mech', name: 'Keyboards' },
  sellerId: 'seller-tech-1',
};

function renderProductsScreen(language: 'vi' | 'en' = 'vi', preference: 'light' | 'dark' = 'light') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  };

  const mockRoute: any = {
    key: 'SellerProducts-test',
    name: 'SellerProducts',
    params: {},
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <SellerProductsScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

function renderFormScreen(language: 'vi' | 'en' = 'vi', preference: 'light' | 'dark' = 'light') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  };

  const mockRoute: any = {
    key: 'SellerProductForm-test',
    name: 'SellerProductForm',
    params: { mode: 'create' },
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <SellerProductFormScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('Seller Products Personalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: { id: 'seller-tech-1', role: 'SELLER', email: 'seller@test.com' } as any,
      token: 'jwt-token-123',
      isAuthenticated: true,
      isInitialized: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    } as any);

    mockedUseSellerProducts.mockReturnValue({
      data: {
        content: [mockProduct],
        totalElements: 1,
        totalPages: 1,
        page: 0,
        size: 20,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseUpdateSellerProduct.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateSellerProductStock.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseDeleteSellerProduct.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseCreateSellerProduct.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseSellerProduct.mockReturnValue({
      data: mockProduct,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseCategories.mockReturnValue({
      data: [{ id: 'cat-mech', name: 'Keyboards' }],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);
  });

  it('renders localized Vietnamese strings and dark theme tokens for Seller Products Screen', () => {
    const { getByText, getByTestId, getAllByText } = renderProductsScreen('vi', 'dark');

    // Title and actions in Vietnamese
    expect(getByText('Quản lý sản phẩm')).toBeTruthy();
    expect(getByText('+ Thêm sản phẩm')).toBeTruthy();
    expect(getByText('Sửa')).toBeTruthy();
    expect(getByText('Cập nhật kho')).toBeTruthy();
    expect(getByText('Ẩn sản phẩm')).toBeTruthy();
    expect(getAllByText('Đang bán').length).toBeGreaterThanOrEqual(1);

    // Raw dynamic fields preserved
    expect(getByText('Mechanical Gaming Keyboard TKL')).toBeTruthy();
    expect(getByText('Keyboards')).toBeTruthy();
    expect(getByText('1.850.000 ₫')).toBeTruthy();

    // Dark theme token check
    const screen = getByTestId('seller-products-screen');
    expect(screen.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#121212' })])
    );
  });

  it('renders localized Vietnamese strings for Seller Product Form Screen in light mode', () => {
    const { getByText, getByTestId } = renderFormScreen('vi', 'light');

    expect(getByText('Đăng bán sản phẩm')).toBeTruthy();
    expect(getByText('Tên sản phẩm *')).toBeTruthy();
    expect(getByText('Danh mục sản phẩm *')).toBeTruthy();
    expect(getByText('Giá bán (VND) *')).toBeTruthy();
    expect(getByText('Số lượng tồn kho ban đầu *')).toBeTruthy();
    expect(getByText('Trạng thái mở bán')).toBeTruthy();

    const screen = getByTestId('seller-product-form-screen');
    expect(screen.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FFFFFF' })])
    );
  });

  it('renders localized English strings for Seller Products Screen in light mode', () => {
    const { getByText, getByTestId, getAllByText } = renderProductsScreen('en', 'light');

    expect(getByText('Products Workspace')).toBeTruthy();
    expect(getByText('+ Add Product')).toBeTruthy();
    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Update Stock')).toBeTruthy();
    expect(getByText('Unlist')).toBeTruthy();
    expect(getAllByText('Listed').length).toBeGreaterThanOrEqual(1);

    const screen = getByTestId('seller-products-screen');
    expect(screen.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FFFFFF' })])
    );
  });
});
