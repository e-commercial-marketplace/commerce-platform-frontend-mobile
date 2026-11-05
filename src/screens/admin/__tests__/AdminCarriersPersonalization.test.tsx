import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AdminCarrierScreen from '../AdminCarrierScreen';
import { AppThemeProvider } from '../../../theme';
import { AppI18nProvider } from '../../../i18n';
import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminCarriers,
  useCreateAdminCarrier,
  useUpdateAdminCarrier,
} from '../../../hooks/useAdmin';
import type { Carrier } from '../../../types/adminApi';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminCarriers = useAdminCarriers as jest.MockedFunction<typeof useAdminCarriers>;
const mockedUseCreateCarrier = useCreateAdminCarrier as jest.MockedFunction<typeof useCreateAdminCarrier>;
const mockedUseUpdateCarrier = useUpdateAdminCarrier as jest.MockedFunction<typeof useUpdateAdminCarrier>;

function renderAdminCarrierScreen(
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
    key: 'AdminCarrier-test',
    name: 'AdminCarrier',
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
          <AdminCarrierScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminCarrierScreen UI Personalization (Theme & i18n)', () => {
  const mockCarriers: Carrier[] = [
    {
      id: '1',
      name: 'Giao Hàng Nhanh',
      active: true,
    },
    {
      id: '2',
      name: 'Viettel Post',
      active: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAdminCarriers.mockReturnValue({
      data: mockCarriers,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseCreateCarrier.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateCarrier.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);
  });

  it('renders default Vietnamese strings and carrier list in light theme', () => {
    const { getByText, getByTestId } = renderAdminCarrierScreen('vi', 'light', 'ADMIN');

    expect(getByText('Đơn vị vận chuyển')).toBeTruthy();
    expect(getByText('＋ Thêm đơn vị')).toBeTruthy();
    expect(getByText('Tất cả (2)')).toBeTruthy();
    expect(getByText('Giao Hàng Nhanh')).toBeTruthy();
    expect(getByText('Viettel Post')).toBeTruthy();
    expect(getByTestId('admin-carrier-card-1')).toBeTruthy();
    expect(getByTestId('admin-carrier-card-2')).toBeTruthy();
  });

  it('renders English strings when language is switched to en', () => {
    const { getByText, getByPlaceholderText } = renderAdminCarrierScreen('en', 'light', 'ADMIN');

    expect(getByText('Shipping Carriers')).toBeTruthy();
    expect(getByText('＋ Add Carrier')).toBeTruthy();
    expect(getByText('All (2)')).toBeTruthy();
    expect(getByPlaceholderText('Search by carrier name or UUID...')).toBeTruthy();
  });

  it('renders in dark theme without crashing and mounts themed elements', () => {
    const { getByText, getByTestId } = renderAdminCarrierScreen('vi', 'dark', 'ADMIN');

    expect(getByText('Đơn vị vận chuyển')).toBeTruthy();
    expect(getByTestId('admin-carrier-card-1')).toBeTruthy();
  });

  it('renders localized unauthorized guard in Vietnamese and English', () => {
    const viRender = renderAdminCarrierScreen('vi', 'light', 'CUSTOMER');
    expect(viRender.getByText('Truy cập bị từ chối')).toBeTruthy();
    expect(viRender.getByText('Quay lại')).toBeTruthy();

    const enRender = renderAdminCarrierScreen('en', 'light', 'CUSTOMER');
    expect(enRender.getByText('Access Denied')).toBeTruthy();
    expect(enRender.getByText('Go Back')).toBeTruthy();
  });

  it('renders localized empty state when carrier list is empty', () => {
    mockedUseAdminCarriers.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = renderAdminCarrierScreen('en', 'light', 'ADMIN');
    expect(getByText('No Carriers Available')).toBeTruthy();
  });
});
