import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminSellerApprovalScreen from '../AdminSellerApprovalScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminSellers,
  useApproveSeller,
  useSuspendSeller,
} from '../../../hooks/useAdmin';
import type { AdminUser, AdminUserPage } from '../../../types/adminApi';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminSellers = useAdminSellers as jest.MockedFunction<typeof useAdminSellers>;
const mockedUseApproveSeller = useApproveSeller as jest.MockedFunction<typeof useApproveSeller>;
const mockedUseSuspendSeller = useSuspendSeller as jest.MockedFunction<typeof useSuspendSeller>;

function renderAdminSellerApprovalScreen(
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
    key: 'AdminSellerApproval-test',
    name: 'AdminSellerApproval',
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
          <AdminSellerApprovalScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminSellerApprovalScreen UI Personalization (Theme & i18n)', () => {
  const mockSellers: AdminUser[] = [
    {
      id: 'seller-1',
      email: 'pending@shop.vn',
      name: 'Shop Cho Duyet',
      phone: '0901112222',
      address: '123 Nguyen Trai, Q5, HCMC',
      role: 'SELLER',
      sellerStatus: 'PENDING',
      enabled: true,
      createdAt: '2026-10-31T08:00:00Z',
      updatedAt: '2026-10-31T08:00:00Z',
    },
    {
      id: 'seller-2',
      email: 'approved@shop.vn',
      name: 'Shop Da Duyet',
      phone: '0903334444',
      address: '456 Tran Hung Dao, Q1, HCMC',
      role: 'SELLER',
      sellerStatus: 'APPROVED',
      enabled: true,
      createdAt: '2026-10-30T08:00:00Z',
      updatedAt: '2026-10-30T08:00:00Z',
    },
  ];

  const mockPageData: AdminUserPage = {
    content: mockSellers,
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAdminSellers.mockReturnValue({
      data: mockPageData,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseApproveSeller.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseSuspendSeller.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders default Vietnamese strings and seller items in light theme', () => {
    const { getByText, getByTestId } = renderAdminSellerApprovalScreen('vi', 'light', 'ADMIN');

    expect(getByText('Shop Cho Duyet')).toBeTruthy();
    expect(getByText('Chờ duyệt')).toBeTruthy();
    expect(getByText('Shop Da Duyet')).toBeTruthy();
    expect(getByText('Đã duyệt')).toBeTruthy();
    expect(getByTestId('seller-card-seller-1')).toBeTruthy();
    expect(getByTestId('seller-card-seller-2')).toBeTruthy();
  });

  it('renders English strings when language is switched to en', () => {
    const { getByText, getByPlaceholderText } = renderAdminSellerApprovalScreen('en', 'light', 'ADMIN');

    expect(getByPlaceholderText('Search by seller email or name...')).toBeTruthy();
    expect(getByText('Pending')).toBeTruthy();
    expect(getByText('Approved')).toBeTruthy();
    expect(getByText('Shop Cho Duyet')).toBeTruthy();
  });

  it('renders in dark theme without crashing and applies theme styling', () => {
    const { getByText, getByTestId } = renderAdminSellerApprovalScreen('vi', 'dark', 'ADMIN');

    expect(getByText('Shop Cho Duyet')).toBeTruthy();
    expect(getByTestId('seller-card-seller-1')).toBeTruthy();
  });

  it('renders localized unauthorized guard in Vietnamese and English', () => {
    const viRender = renderAdminSellerApprovalScreen('vi', 'light', 'CUSTOMER');
    expect(viRender.getByText('Yêu cầu quyền Quản trị viên')).toBeTruthy();
    expect(viRender.getByText('Quay lại')).toBeTruthy();

    const enRender = renderAdminSellerApprovalScreen('en', 'light', 'CUSTOMER');
    expect(enRender.getByText('Administrator Permission Required')).toBeTruthy();
    expect(enRender.getByText('Go Back')).toBeTruthy();
  });

  it('renders localized empty state when seller list is empty', () => {
    mockedUseAdminSellers.mockReturnValue({
      data: {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = renderAdminSellerApprovalScreen('en', 'light', 'ADMIN');
    expect(getByText('No Sellers Found')).toBeTruthy();
  });
});
