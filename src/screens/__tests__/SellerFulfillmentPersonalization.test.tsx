import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SellerFulfillmentScreen from '../SellerFulfillmentScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import {
  useCancelSellerOrderItem,
  useConfirmSellerOrderItem,
  useCreateSellerShipment,
  useSellerCarriers,
  useSellerOrderItems,
  useSellerShipments,
  useUpdateSellerShipmentStatus,
} from '../../hooks/useSellerFulfillment';
import type {
  PageResponse,
  SellerOrderItem,
  SellerShipment,
} from '../../types/sellerApi';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useSellerFulfillment');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseSellerOrderItems = useSellerOrderItems as jest.MockedFunction<
  typeof useSellerOrderItems
>;
const mockedUseConfirmSellerOrderItem = useConfirmSellerOrderItem as jest.MockedFunction<
  typeof useConfirmSellerOrderItem
>;
const mockedUseCancelSellerOrderItem = useCancelSellerOrderItem as jest.MockedFunction<
  typeof useCancelSellerOrderItem
>;
const mockedUseCreateSellerShipment = useCreateSellerShipment as jest.MockedFunction<
  typeof useCreateSellerShipment
>;
const mockedUseSellerCarriers = useSellerCarriers as jest.MockedFunction<
  typeof useSellerCarriers
>;
const mockedUseSellerShipments = useSellerShipments as jest.MockedFunction<
  typeof useSellerShipments
>;
const mockedUseUpdateSellerShipmentStatus = useUpdateSellerShipmentStatus as jest.MockedFunction<
  typeof useUpdateSellerShipmentStatus
>;

const mockPendingItem: SellerOrderItem = {
  id: 'oi-pending-1',
  orderId: 'order-uuid-1111',
  productId: 'prod-uuid-1',
  productName: 'Ergonomic Mechanical Keyboard',
  unitPrice: '1500000.00',
  quantity: 2,
  status: 'PENDING',
  sellerId: 'seller-1',
};

const mockShipment: SellerShipment = {
  id: 'ship-prep-2',
  orderId: 'order-uuid-2222',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-ghn', name: 'Giao Hang Nhanh (GHN)' },
  status: 'PREPARING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'oi-confirmed-2', quantity: 1 }],
};

function renderFulfillmentScreen(
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light'
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
    key: 'SellerFulfillment-test',
    name: 'SellerFulfillment',
    params: {},
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <SellerFulfillmentScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('SellerFulfillmentScreen UI Personalization (Theme & i18n)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: {
        id: 'seller-1',
        email: 'seller@example.com',
        name: 'Tech Store Seller',
        role: 'SELLER',
      },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    } as any);

    mockedUseConfirmSellerOrderItem.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseCancelSellerOrderItem.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseCreateSellerShipment.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseUpdateSellerShipmentStatus.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as any);

    mockedUseSellerCarriers.mockReturnValue({
      data: [{ id: 'carrier-ghn', name: 'Giao Hang Nhanh (GHN)', active: true }],
      isLoading: false,
    } as any);

    const itemsPage: PageResponse<SellerOrderItem> = {
      content: [mockPendingItem],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };

    mockedUseSellerOrderItems.mockReturnValue({
      data: itemsPage,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const shipmentsPage: PageResponse<SellerShipment> = {
      content: [mockShipment],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };

    mockedUseSellerShipments.mockReturnValue({
      data: shipmentsPage,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  it('renders correctly in Vietnamese with localized workspace labels, filter tabs, and actions', () => {
    const { getByText, getAllByText } = renderFulfillmentScreen('vi', 'light');

    // Title and subtitle in Vietnamese
    expect(getByText('Xử lý đơn hàng')).toBeTruthy();
    expect(getByText('Xác nhận đơn hàng và điều phối vận chuyển')).toBeTruthy();

    // Workspace tabs in Vietnamese
    expect(getByText('Sản phẩm chờ giao')).toBeTruthy();
    expect(getByText('Kiện hàng')).toBeTruthy();

    // Filter tabs & status badge in Vietnamese (appears in tab and card badge)
    expect(getAllByText('Chờ xác nhận').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Đã xác nhận')).toBeTruthy();
    expect(getByText('Đã hủy')).toBeTruthy();

    // Actions in Vietnamese
    expect(getByText('Xác nhận')).toBeTruthy();
    expect(getByText('Hủy món')).toBeTruthy();

    // Invariant dynamic backend data must not be translated
    expect(getByText('Ergonomic Mechanical Keyboard')).toBeTruthy();
    expect(getByText(/order-uu/)).toBeTruthy();
  });

  it('renders correctly in English with localized workspace labels, filter tabs, and actions', () => {
    const { getByText, getAllByText } = renderFulfillmentScreen('en', 'light');

    // Title and subtitle in English
    expect(getByText('Seller Fulfillment')).toBeTruthy();
    expect(getByText('Manage line-item confirmation and shipment dispatch')).toBeTruthy();

    // Workspace tabs in English
    expect(getByText('Order Items')).toBeTruthy();
    expect(getByText('Shipments')).toBeTruthy();

    // Filter tabs & status badge in English (appears in tab and card badge)
    expect(getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Confirmed')).toBeTruthy();
    expect(getByText('Cancelled')).toBeTruthy();

    // Actions in English
    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();

    // Invariant dynamic backend data must not be translated
    expect(getByText('Ergonomic Mechanical Keyboard')).toBeTruthy();
    expect(getByText(/order-uu/)).toBeTruthy();
  });

  it('renders correctly in Dark Mode with dark theme background and surface colors', () => {
    const { getByText, getByTestId } = renderFulfillmentScreen('vi', 'dark');

    // Verify dark container background
    const container = getByTestId('seller-fulfillment-screen');
    const containerStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(containerStyle.backgroundColor).toBe('#121212');

    // Content still renders correctly in dark mode
    expect(getByText('Xử lý đơn hàng')).toBeTruthy();
    expect(getByText('Ergonomic Mechanical Keyboard')).toBeTruthy();
  });

  it('switches to Shipments workspace and displays localized shipment statuses', () => {
    const { getByText, getAllByText } = renderFulfillmentScreen('vi', 'light');

    // Click Shipments workspace tab
    fireEvent.press(getByText('Kiện hàng'));

    // Verify shipment status filter tabs in Vietnamese (PREPARING appears in both tab and shipment card)
    expect(getAllByText('Đang đóng gói').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Đang vận chuyển')).toBeTruthy();
    expect(getByText('Đã giao')).toBeTruthy();

    // Verify carrier name and tracking info (authoritative data)
    expect(getByText('Giao Hang Nhanh (GHN)')).toBeTruthy();
  });
});
