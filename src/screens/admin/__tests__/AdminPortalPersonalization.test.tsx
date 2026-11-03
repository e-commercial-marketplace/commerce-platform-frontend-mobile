import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminPortalScreen from '../AdminPortalScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';

jest.mock('../../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function renderAdminPortalScreen(
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
    key: 'AdminPortal-test',
    name: 'AdminPortal',
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
        name: 'Super Admin',
        role: userRole,
      },
      isAuthenticated: true,
    } as any);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <AdminPortalScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminPortalScreen UI Personalization (Theme & i18n)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default Vietnamese strings and all 5 navigation modules in light theme', () => {
    const { getByText, getByTestId } = renderAdminPortalScreen('vi', 'light', 'ADMIN');

    expect(getByText('Quản trị hệ thống')).toBeTruthy();
    expect(getByText(/Xin chào, Super Admin/)).toBeTruthy();
    expect(getByText('Quản lý người dùng')).toBeTruthy();
    expect(getByText('Quản lý người bán')).toBeTruthy();
    expect(getByText('Quản lý danh mục')).toBeTruthy();
    expect(getByText('Quản lý mã giảm giá')).toBeTruthy();
    expect(getByText('Quản lý đơn vị vận chuyển')).toBeTruthy();

    expect(getByTestId('admin-portal-user-management-btn')).toBeTruthy();
    expect(getByTestId('admin-portal-seller-management-btn')).toBeTruthy();
    expect(getByTestId('admin-portal-category-management-btn')).toBeTruthy();
    expect(getByTestId('admin-portal-voucher-management-btn')).toBeTruthy();
    expect(getByTestId('admin-portal-carrier-management-btn')).toBeTruthy();
  });

  it('renders English strings when language is switched to en', () => {
    const { getByText } = renderAdminPortalScreen('en', 'light', 'ADMIN');

    expect(getByText('System Administration')).toBeTruthy();
    expect(getByText(/Hello, Super Admin/)).toBeTruthy();
    expect(getByText('User Management')).toBeTruthy();
    expect(getByText('Seller Management')).toBeTruthy();
    expect(getByText('Category Management')).toBeTruthy();
    expect(getByText('Voucher Management')).toBeTruthy();
    expect(getByText('Shipping Carrier Management')).toBeTruthy();
  });

  it('renders in dark theme without crashing and mounts themed elements', () => {
    const { getByText, getByTestId } = renderAdminPortalScreen('vi', 'dark', 'ADMIN');

    expect(getByText('Quản trị hệ thống')).toBeTruthy();
    expect(getByTestId('admin-portal-user-management-btn')).toBeTruthy();
  });

  it('renders localized unauthorized guard in Vietnamese and English', () => {
    const viRender = renderAdminPortalScreen('vi', 'light', 'CUSTOMER');
    expect(viRender.getByText('Truy cập bị từ chối')).toBeTruthy();
    expect(viRender.getByText('Quay lại')).toBeTruthy();

    const enRender = renderAdminPortalScreen('en', 'light', 'CUSTOMER');
    expect(enRender.getByText('Access Denied')).toBeTruthy();
    expect(enRender.getByText('Go Back')).toBeTruthy();
  });
});
