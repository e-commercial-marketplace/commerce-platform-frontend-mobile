import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminVoucherScreen from '../AdminVoucherScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminVouchers,
  useCreateAdminVoucher,
  useExpireAdminVoucher,
  useUpdateAdminVoucher,
} from '../../../hooks/useAdmin';
import type { AdminVoucherPage } from '../../../types/adminApi';
import type { VoucherResponse } from '../../../types/voucherApi';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminVouchers = useAdminVouchers as jest.MockedFunction<typeof useAdminVouchers>;
const mockedUseCreateVoucher = useCreateAdminVoucher as jest.MockedFunction<typeof useCreateAdminVoucher>;
const mockedUseUpdateVoucher = useUpdateAdminVoucher as jest.MockedFunction<typeof useUpdateAdminVoucher>;
const mockedUseExpireVoucher = useExpireAdminVoucher as jest.MockedFunction<typeof useExpireAdminVoucher>;

function renderAdminVoucherScreen(
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
    key: 'AdminVoucher-test',
    name: 'AdminVoucher',
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
          <AdminVoucherScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminVoucherScreen UI Personalization (Theme & i18n)', () => {
  const mockVouchers: VoucherResponse[] = [
    {
      code: 'SALE50',
      description: 'Giảm 50%',
      discountPercent: 50,
      usageLimit: 100,
      timesUsed: 10,
      validFrom: '2026-10-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
    },
    {
      code: 'FREESHIP',
      description: 'Miễn phí vận chuyển',
      discountPercent: 100,
      usageLimit: 50,
      timesUsed: 50,
      validFrom: '2026-10-01T00:00:00Z',
      validTo: '2026-12-31T23:59:59Z',
    },
  ];

  const mockPageData: AdminVoucherPage = {
    content: mockVouchers,
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAdminVouchers.mockReturnValue({
      data: mockPageData,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseCreateVoucher.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateVoucher.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseExpireVoucher.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders default Vietnamese strings and vouchers in light theme', () => {
    const { getByText, getByTestId } = renderAdminVoucherScreen('vi', 'light', 'ADMIN');

    expect(getByText('Mã giảm giá toàn sàn')).toBeTruthy();
    expect(getByText('＋ Tạo voucher')).toBeTruthy();
    expect(getByText('SALE50')).toBeTruthy();
    expect(getByText('FREESHIP')).toBeTruthy();
    expect(getByTestId('admin-voucher-card-SALE50')).toBeTruthy();
    expect(getByTestId('admin-voucher-card-FREESHIP')).toBeTruthy();
  });

  it('renders English strings when language is switched to en', () => {
    const { getByText, getByTestId } = renderAdminVoucherScreen('en', 'light', 'ADMIN');

    expect(getByText('Platform Vouchers')).toBeTruthy();
    expect(getByText('＋ Create Voucher')).toBeTruthy();
    expect(getByText('SALE50')).toBeTruthy();
    expect(getByTestId('admin-voucher-card-SALE50')).toBeTruthy();
  });

  it('renders in dark theme without crashing and applies theme styling', () => {
    const { getByText, getByTestId } = renderAdminVoucherScreen('vi', 'dark', 'ADMIN');

    expect(getByText('Mã giảm giá toàn sàn')).toBeTruthy();
    expect(getByTestId('admin-voucher-card-SALE50')).toBeTruthy();
  });

  it('renders localized unauthorized guard in Vietnamese and English', () => {
    const viRender = renderAdminVoucherScreen('vi', 'light', 'CUSTOMER');
    expect(viRender.getByText('Truy cập bị từ chối')).toBeTruthy();
    expect(viRender.getByText('Quay lại')).toBeTruthy();

    const enRender = renderAdminVoucherScreen('en', 'light', 'CUSTOMER');
    expect(enRender.getByText('Access Denied')).toBeTruthy();
    expect(enRender.getByText('Go Back')).toBeTruthy();
  });

  it('renders localized empty state when voucher list is empty', () => {
    mockedUseAdminVouchers.mockReturnValue({
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

    const { getByText } = renderAdminVoucherScreen('en', 'light', 'ADMIN');
    expect(getByText('No Vouchers Yet')).toBeTruthy();
  });
});
