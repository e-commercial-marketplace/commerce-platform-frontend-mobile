import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminCategoryScreen from '../AdminCategoryScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';
import { useCategories } from '../../../hooks/useProducts';
import {
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from '../../../hooks/useAdmin';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useProducts');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockedUseCreateCategory = useCreateAdminCategory as jest.MockedFunction<typeof useCreateAdminCategory>;
const mockedUseUpdateCategory = useUpdateAdminCategory as jest.MockedFunction<typeof useUpdateAdminCategory>;
const mockedUseDeleteCategory = useDeleteAdminCategory as jest.MockedFunction<typeof useDeleteAdminCategory>;

function renderAdminCategoryScreen(
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light',
  userRole: 'ADMIN' | 'CUSTOMER' | 'GUEST' = 'ADMIN',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  };

  const mockRoute: any = {
    key: 'AdminCategory-test',
    name: 'AdminCategory',
    params: {},
  };

  if (userRole === 'GUEST') {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    } as any);
  } else {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@platform.vn',
        name: 'Admin User',
        role: userRole,
      },
      isAuthenticated: true,
    } as any);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <AdminCategoryScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminCategoryScreen UI Personalization (Theme & i18n)', () => {
  const mockCategories = [
    { id: 1, name: 'Điện thoại' },
    { id: 2, name: 'Laptop' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseCategories.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseCreateCategory.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateCategory.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseDeleteCategory.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders default Vietnamese strings and category list in light theme', () => {
    const { getByText, getByTestId } = renderAdminCategoryScreen('vi', 'light', 'ADMIN');

    expect(getByText('Danh mục sản phẩm')).toBeTruthy();
    expect(getByText('＋ Thêm mới')).toBeTruthy();
    expect(getByText('Điện thoại')).toBeTruthy();
    expect(getByText('Laptop')).toBeTruthy();
    expect(getByTestId('admin-category-item-1')).toBeTruthy();
  });

  it('renders English strings when language is switched to en', () => {
    const { getByText, getByTestId } = renderAdminCategoryScreen('en', 'light', 'ADMIN');

    expect(getByText('Product Categories')).toBeTruthy();
    expect(getByText('＋ Add New')).toBeTruthy();
    expect(getByText('Điện thoại')).toBeTruthy();
    expect(getByText('Laptop')).toBeTruthy();
    expect(getByTestId('admin-category-item-1')).toBeTruthy();
  });

  it('renders in dark theme without crashing and applies theme styling', () => {
    const { getByText, getByTestId } = renderAdminCategoryScreen('vi', 'dark', 'ADMIN');

    expect(getByText('Danh mục sản phẩm')).toBeTruthy();
    expect(getByTestId('admin-category-item-1')).toBeTruthy();
  });

  it('renders localized unauthorized guard in Vietnamese and English', () => {
    const viRender = renderAdminCategoryScreen('vi', 'light', 'CUSTOMER');
    expect(viRender.getByText('Truy cập bị từ chối')).toBeTruthy();
    expect(viRender.getByText('Quay lại')).toBeTruthy();

    const enRender = renderAdminCategoryScreen('en', 'light', 'CUSTOMER');
    expect(enRender.getByText('Access Denied')).toBeTruthy();
    expect(enRender.getByText('Go Back')).toBeTruthy();
  });

  it('renders localized empty state when category list is empty', () => {
    mockedUseCategories.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = renderAdminCategoryScreen('en', 'light', 'ADMIN');
    expect(getByText('No Categories Yet')).toBeTruthy();
  });
});
