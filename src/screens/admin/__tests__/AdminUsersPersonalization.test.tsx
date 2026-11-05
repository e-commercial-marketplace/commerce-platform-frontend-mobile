import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminUserListScreen from '../AdminUserListScreen';
import AdminUserDetailScreen from '../AdminUserDetailScreen';
import AdminUserEditScreen from '../AdminUserEditScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminUsers,
  useAdminUserDetail,
  useDisableAdminUser,
  useUpdateAdminUser,
} from '../../../hooks/useAdmin';
import type { AdminUser, AdminUserPage } from '../../../types/adminApi';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminUsers = useAdminUsers as jest.MockedFunction<typeof useAdminUsers>;
const mockedUseAdminUserDetail = useAdminUserDetail as jest.MockedFunction<typeof useAdminUserDetail>;
const mockedUseDisableAdminUser = useDisableAdminUser as jest.MockedFunction<typeof useDisableAdminUser>;
const mockedUseUpdateAdminUser = useUpdateAdminUser as jest.MockedFunction<typeof useUpdateAdminUser>;

const adminUser: AdminUser = {
  id: 'admin-1',
  email: 'admin@platform.vn',
  name: 'Super Admin',
  phone: null,
  address: null,
  role: 'ADMIN',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const customerUser: AdminUser = {
  id: 'user-2',
  email: 'customer@test.vn',
  name: 'Test Customer',
  phone: '0912345678',
  address: '123 Le Loi, HCMC',
  role: 'CUSTOMER',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
};

const mockUserPage: AdminUserPage = {
  content: [adminUser, customerUser],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};

function renderWithProviders(
  ui: React.ReactElement,
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          {ui}
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('Admin Users UI Personalization & Self-Protection Preservation', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: adminUser,
      isAuthenticated: true,
    } as any);

    mockedUseAdminUsers.mockReturnValue({
      data: mockUserPage,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseAdminUserDetail.mockReturnValue({
      data: customerUser,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseDisableAdminUser.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateAdminUser.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);
  });

  describe('AdminUserListScreen Personalization', () => {
    it('renders user list in Vietnamese light theme', () => {
      const { getByText, getByTestId } = renderWithProviders(
        <AdminUserListScreen navigation={mockNavigation} route={{} as any} />,
        'vi',
        'light',
      );

      expect(getByText('Tổng cộng: 2 tài khoản')).toBeTruthy();
      expect(getByText('+ Thêm mới')).toBeTruthy();
      expect(getByText('Super Admin')).toBeTruthy();
      expect(getByText('Test Customer')).toBeTruthy();
      expect(getByTestId('user-item-admin-1')).toBeTruthy();
    });

    it('renders user list in English', () => {
      const { getByText } = renderWithProviders(
        <AdminUserListScreen navigation={mockNavigation} route={{} as any} />,
        'en',
        'light',
      );

      expect(getByText('Total: 2 accounts')).toBeTruthy();
      expect(getByText('+ Add New')).toBeTruthy();
    });

    it('renders user list in dark theme without crashing', () => {
      const { getByText, getByTestId } = renderWithProviders(
        <AdminUserListScreen navigation={mockNavigation} route={{} as any} />,
        'vi',
        'dark',
      );

      expect(getByText('Super Admin')).toBeTruthy();
      expect(getByTestId('user-item-admin-1')).toBeTruthy();
    });
  });

  describe('AdminUserDetailScreen Personalization & Self-Protection', () => {
    it('enforces admin self-protection when viewing own profile in Vietnamese', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: adminUser, // viewing self
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId, getByText } = renderWithProviders(
        <AdminUserDetailScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
        'vi',
        'light',
      );

      expect(getByTestId('self-protection-notice')).toBeTruthy();
      expect(
        getByText(
          'Đây là tài khoản của bạn. Để đảm bảo an toàn hệ thống, bạn không thể tự khoá hoặc hạ vai trò của chính mình.',
        ),
      ).toBeTruthy();
      expect(queryByTestId('disable-user-button')).toBeNull();
    });

    it('enforces admin self-protection when viewing own profile in English', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: adminUser, // viewing self
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId, getByText } = renderWithProviders(
        <AdminUserDetailScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
        'en',
        'light',
      );

      expect(getByTestId('self-protection-notice')).toBeTruthy();
      expect(
        getByText(
          'This is your account. For system safety, you cannot disable or demote your own account.',
        ),
      ).toBeTruthy();
      expect(queryByTestId('disable-user-button')).toBeNull();
    });

    it('allows disabling another user without self-protection notice', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: customerUser, // viewing customer
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId } = renderWithProviders(
        <AdminUserDetailScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'user-2' } } as any}
        />,
        'vi',
        'light',
      );

      expect(queryByTestId('self-protection-notice')).toBeNull();
      expect(getByTestId('disable-user-button')).toBeTruthy();
    });
  });

  describe('AdminUserEditScreen Self-Protection Preservation', () => {
    it('prevents self-role demotion when editing self in Vietnamese', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: adminUser, // editing self
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId, getByText } = renderWithProviders(
        <AdminUserEditScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
        'vi',
        'light',
      );

      expect(getByTestId('edit-self-role-notice')).toBeTruthy();
      expect(
        getByText(
          'Bạn đang chỉnh sửa tài khoản của mình. Admin không thể tự đổi vai trò của chính mình.',
        ),
      ).toBeTruthy();
      expect(queryByTestId('edit-role-CUSTOMER')).toBeNull();
    });

    it('prevents self-role demotion when editing self in English', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: adminUser, // editing self
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId, getByText } = renderWithProviders(
        <AdminUserEditScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
        'en',
        'light',
      );

      expect(getByTestId('edit-self-role-notice')).toBeTruthy();
      expect(
        getByText(
          'You are editing your own account. Administrators cannot change their own role.',
        ),
      ).toBeTruthy();
      expect(queryByTestId('edit-role-CUSTOMER')).toBeNull();
    });

    it('allows role selection when editing another user', () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: customerUser, // editing customer
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByTestId, queryByTestId } = renderWithProviders(
        <AdminUserEditScreen
          navigation={mockNavigation}
          route={{ params: { userId: 'user-2' } } as any}
        />,
        'vi',
        'light',
      );

      expect(queryByTestId('edit-self-role-notice')).toBeNull();
      expect(getByTestId('edit-role-CUSTOMER')).toBeTruthy();
      expect(getByTestId('edit-role-SELLER')).toBeTruthy();
      expect(getByTestId('edit-role-ADMIN')).toBeTruthy();
    });
  });
});
