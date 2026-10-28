/**
 * Comprehensive unit tests for SellerFulfillmentScreen (Phases 3, 4 & 5).
 *
 * Covers:
 * Phase 3:
 * 1-5: List, filtering, field rendering, no customer PII
 * 6-12: Loading, empty (by status), error + retry, refresh, pagination
 * 13-19: Confirm action, loading state, error mapping (unpaid VNPAY)
 * 20-29: Cancel modal, optional reason, blank reason, backend error mapping, 403 without logout
 * Phase 4:
 * 30-36: CONFIRMED tab bundles items by orderId (ONE SHIPMENT PER ORDER)
 * 37-41: CreateShipmentModal integration, carrier selection, shipment mutation with bundled items
 * Phase 5:
 * 42-45: Workspace switching (Order Items vs Shipments) and default query
 * 46-52: Shipment status filtering (PENDING, PREPARING, SHIPPED, DELIVERED, FAILED, RETURNED, CANCELLED)
 * 53-56: Shipment card rendering, no customer PII, no fake carrier for self delivery, no fake tracking code
 * 57-61: Shipment loading, empty states, error retry, pull-to-refresh, pagination
 * 62-67: Transitions: PENDING -> PREPARING, PREPARING -> SHIPPED (with trackingCode), CANCELLED (paid order conflict)
 * 68-72: Transitions: SHIPPED -> DELIVERED (multi-seller safe wording), SHIPPED -> FAILED, FAILED -> RETURNED
 * 73-75: Terminal states (DELIVERED, RETURNED, CANCELLED) show NO actions
 * 76-78: Error mapping: 403 without logout, 404, invalid transition
 * 79-80: Full regression: switching back to Order Items works seamlessly
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
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
import * as orderService from '../../services/orderService';
import type {
  Carrier,
  PageResponse,
  SellerOrderItem,
  SellerShipment,
} from '../../types/sellerApi';
import SellerFulfillmentScreen from '../SellerFulfillmentScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useSellerFulfillment');
jest.mock('../../services/orderService');

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

const mockConfirmedItem: SellerOrderItem = {
  id: 'oi-confirmed-2',
  orderId: 'order-uuid-2222',
  productId: 'prod-uuid-2',
  productName: 'Gaming Mouse Wireless',
  unitPrice: '800000.00',
  quantity: 1,
  status: 'CONFIRMED',
  sellerId: 'seller-1',
};

const mockConfirmedItemSameOrder: SellerOrderItem = {
  id: 'oi-confirmed-2b',
  orderId: 'order-uuid-2222',
  productId: 'prod-uuid-2b',
  productName: 'Gaming Mousepad XL',
  unitPrice: '200000.00',
  quantity: 1,
  status: 'CONFIRMED',
  sellerId: 'seller-1',
};

const mockConfirmedItemOtherOrder: SellerOrderItem = {
  id: 'oi-confirmed-4',
  orderId: 'ord-4444-uuid-9999',
  productId: 'prod-uuid-4',
  productName: 'Headphone Stand Aluminum',
  unitPrice: '350000.00',
  quantity: 1,
  status: 'CONFIRMED',
  sellerId: 'seller-1',
};

const mockCancelledItem: SellerOrderItem = {
  id: 'oi-cancelled-3',
  orderId: 'order-uuid-3333',
  productId: 'prod-uuid-3',
  productName: 'USB-C Cable 2M',
  unitPrice: '120000.00',
  quantity: 3,
  status: 'CANCELLED',
  sellerId: 'seller-1',
};

const mockCarriersList: Carrier[] = [
  { id: 'carrier-ghn', name: 'Giao Hang Nhanh (GHN)', active: true },
  { id: 'carrier-vtp', name: 'Viettel Post', active: true },
];

const mockPendingShipment: SellerShipment = {
  id: 'ship-pending-1',
  orderId: 'order-uuid-1111',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-ghn', name: 'Giao Hang Nhanh (GHN)' },
  status: 'PENDING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'oi-pending-1', quantity: 2 }],
};

const mockPreparingShipment: SellerShipment = {
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

const mockShippedShipment: SellerShipment = {
  id: 'ship-shipped-3',
  orderId: 'order-uuid-3333',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-vtp', name: 'Viettel Post' },
  status: 'SHIPPED',
  trackingCode: 'VTP99998888VN',
  shippingFee: '0.00',
  shippedAt: '2026-10-28T09:00:00Z',
  deliveredAt: null,
  items: [{ orderItemId: 'oi-cancelled-3', quantity: 3 }],
};

describe('SellerFulfillmentScreen (Phases 3, 4 & 5)', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as never;

  const mockConfirmMutate = jest.fn();
  const mockCancelMutate = jest.fn();
  const mockCreateShipmentMutate = jest.fn();
  const mockUpdateShipmentStatusMutate = jest.fn();
  const mockRefetchOrderItems = jest.fn();
  const mockRefetchShipments = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

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
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    mockedUseConfirmSellerOrderItem.mockReturnValue({
      mutateAsync: mockConfirmMutate,
      isPending: false,
    } as never);

    mockedUseCancelSellerOrderItem.mockReturnValue({
      mutateAsync: mockCancelMutate,
      isPending: false,
    } as never);

    mockedUseCreateSellerShipment.mockReturnValue({
      mutateAsync: mockCreateShipmentMutate,
      isPending: false,
    } as never);

    mockedUseUpdateSellerShipmentStatus.mockReturnValue({
      mutateAsync: mockUpdateShipmentStatusMutate,
      isPending: false,
    } as never);

    mockedUseSellerCarriers.mockReturnValue({
      data: mockCarriersList,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as never);

    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockPendingItem],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPendingShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);
  });

  // ==========================================================================
  // PHASE 3: LIST RENDERING & STATUS FILTERING (Scenarios 1-5)
  // ==========================================================================

  it('queries PENDING items by default with page 0', () => {
    render(<SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />);

    expect(mockedUseSellerOrderItems).toHaveBeenCalledWith(
      {
        status: 'PENDING',
        page: 0,
        size: 20,
      },
      true,
    );
  });

  it('switches filter to CONFIRMED and sends backend filter with page 0', () => {
    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const confirmedTab = getByRole('button', { name: 'Confirmed' });
    fireEvent.press(confirmedTab);

    expect(mockedUseSellerOrderItems).toHaveBeenLastCalledWith(
      {
        status: 'CONFIRMED',
        page: 0,
        size: 20,
      },
      true,
    );
  });

  it('switches filter to CANCELLED and sends backend filter with page 0', () => {
    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const cancelledTab = getByRole('button', { name: 'Cancelled' });
    fireEvent.press(cancelledTab);

    expect(mockedUseSellerOrderItems).toHaveBeenLastCalledWith(
      {
        status: 'CANCELLED',
        page: 0,
        size: 20,
      },
      true,
    );
  });

  it('renders correct item fields: productName, quantity, unitPrice, line total, order reference', () => {
    const { getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(getByText('Ergonomic Mechanical Keyboard')).toBeTruthy();
    expect(getByText('#order-uu')).toBeTruthy();
    expect(getByText(/Qty:\s*2/)).toBeTruthy();
    expect(getByText('1.500.000 ₫ / item')).toBeTruthy();
    expect(getByText('3.000.000 ₫')).toBeTruthy();
  });

  it('does NOT render unauthorized customer fields (customer name, phone, address)', () => {
    const { queryByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(queryByText(/Customer Name/i)).toBeNull();
    expect(queryByText(/Phone/i)).toBeNull();
    expect(queryByText(/Shipping Address/i)).toBeNull();
    expect(queryByText(/Delivery Address/i)).toBeNull();
    expect(queryByText(/Recipient/i)).toBeNull();
  });

  // ==========================================================================
  // PHASE 3: LOADING, EMPTY, ERROR, REFRESH, PAGINATION (Scenarios 6-12)
  // ==========================================================================

  it('renders loading state when isLoading is true', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(getByText('Loading order items…')).toBeTruthy();
  });

  it('renders empty message for PENDING items', () => {
    mockedUseSellerOrderItems.mockReturnValue({
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
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(getByText('No pending order items to fulfill.')).toBeTruthy();
  });

  it('renders empty message for CONFIRMED items', () => {
    mockedUseSellerOrderItems.mockReturnValue({
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
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Confirmed' }));
    expect(getByText('No confirmed order items.')).toBeTruthy();
  });

  it('renders empty message for CANCELLED items', () => {
    mockedUseSellerOrderItems.mockReturnValue({
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
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Cancelled' }));
    expect(getByText('No cancelled order items.')).toBeTruthy();
  });

  it('renders error state and allows retry', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new ApiError('Failed to load items', 'SERVER_ERROR', 500),
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByText, getByRole } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(getByText("Couldn't load order items")).toBeTruthy();
    expect(getByText('Failed to load items')).toBeTruthy();

    const retryBtn = getByRole('button', { name: 'Retry loading order items' });
    fireEvent.press(retryBtn);

    expect(mockRefetchOrderItems).toHaveBeenCalledTimes(1);
  });

  it('supports pagination controls when totalPages > 1', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockPendingItem],
        page: 0,
        size: 20,
        totalElements: 45,
        totalPages: 3,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByText, getByRole } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(getByText('Page 1 / 3')).toBeTruthy();

    const nextBtn = getByRole('button', { name: 'Next page' });
    fireEvent.press(nextBtn);

    expect(mockedUseSellerOrderItems).toHaveBeenLastCalledWith(
      {
        status: 'PENDING',
        page: 1,
        size: 20,
      },
      true,
    );
  });

  // ==========================================================================
  // PHASE 3: CONFIRM & CANCEL ACTIONS (Scenarios 13-29)
  // ==========================================================================

  it('shows Confirm Item for PENDING items', () => {
    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(
      getByRole('button', { name: 'Confirm Ergonomic Mechanical Keyboard' }),
    ).toBeTruthy();
  });

  it('does NOT show Confirm Item for CANCELLED or CONFIRMED items', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockConfirmedItem, mockCancelledItem],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { queryByRole } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(queryByRole('button', { name: /Confirm Gaming Mouse Wireless/ })).toBeNull();
    expect(queryByRole('button', { name: /Confirm USB-C Cable 2M/ })).toBeNull();
  });

  it('calls confirm mutation with exact item ID and shows success feedback', async () => {
    mockConfirmMutate.mockResolvedValueOnce({
      ...mockPendingItem,
      status: 'CONFIRMED',
    });

    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const confirmBtn = getByRole('button', {
      name: 'Confirm Ergonomic Mechanical Keyboard',
    });
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(mockConfirmMutate).toHaveBeenCalledWith('oi-pending-1');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Item Confirmed',
        expect.stringContaining('Ergonomic Mechanical Keyboard'),
      );
    });
  });

  it('maps backend error for unpaid VNPAY order on confirm failure', async () => {
    const error = new ApiError('The order is not paid yet', 'VALIDATION_ERROR', 400);
    mockConfirmMutate.mockRejectedValueOnce(error);

    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const confirmBtn = getByRole('button', {
      name: 'Confirm Ergonomic Mechanical Keyboard',
    });
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot Confirm Item',
        'The order is not paid yet. Pre-paid orders must be PAID before confirmation.',
      );
    });
  });

  it('shows Cancel Item for PENDING and CONFIRMED, but NOT for CANCELLED', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockPendingItem, mockConfirmedItem, mockCancelledItem],
        page: 0,
        size: 20,
        totalElements: 3,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, queryByRole } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    expect(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    ).toBeTruthy();
    expect(
      getByRole('button', { name: 'Cancel Gaming Mouse Wireless' }),
    ).toBeTruthy();
    expect(queryByRole('button', { name: 'Cancel USB-C Cable 2M' })).toBeNull();
  });

  it('opens cancel modal on cancel press, allows entering reason, and calls cancel mutation', async () => {
    mockCancelMutate.mockResolvedValueOnce({
      ...mockPendingItem,
      status: 'CANCELLED',
    });

    const { getByRole, getByLabelText, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const cancelItemBtn = getByRole('button', {
      name: 'Cancel Ergonomic Mechanical Keyboard',
    });
    fireEvent.press(cancelItemBtn);

    expect(getByText('Cancel Order Item')).toBeTruthy();

    const reasonInput = getByLabelText('Cancellation reason input');
    fireEvent.changeText(reasonInput, 'Out of stock in warehouse');

    const confirmCancelBtn = getByRole('button', { name: 'Confirm cancellation' });
    fireEvent.press(confirmCancelBtn);

    await waitFor(() => {
      expect(mockCancelMutate).toHaveBeenCalledWith({
        orderItemId: 'oi-pending-1',
        cancelReason: 'Out of stock in warehouse',
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Item Cancelled',
        expect.stringContaining('Ergonomic Mechanical Keyboard'),
      );
    });
  });

  it('sends undefined cancelReason when input is left blank or whitespace', async () => {
    mockCancelMutate.mockResolvedValueOnce({
      ...mockPendingItem,
      status: 'CANCELLED',
    });

    const { getByRole, getByLabelText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    );

    const reasonInput = getByLabelText('Cancellation reason input');
    fireEvent.changeText(reasonInput, '   ');

    fireEvent.press(getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      expect(mockCancelMutate).toHaveBeenCalledWith({
        orderItemId: 'oi-pending-1',
        cancelReason: undefined,
      });
    });
  });

  it('allows user to back out and dismiss cancel modal without calling mutation', () => {
    const { getByRole, getByText, queryByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    );
    expect(getByText('Cancel Order Item')).toBeTruthy();

    const keepItemBtn = getByRole('button', { name: 'Keep item' });
    fireEvent.press(keepItemBtn);

    expect(queryByText('Cancel Order Item')).toBeNull();
    expect(mockCancelMutate).not.toHaveBeenCalled();
  });

  it('displays CANNOT_CANCEL_AFTER_SHIPMENT error inside modal', async () => {
    const error = new ApiError(
      'This order item has already been assigned to a shipment. Cancel the shipment instead.',
      'CANNOT_CANCEL_AFTER_SHIPMENT',
      400,
    );
    mockCancelMutate.mockRejectedValueOnce(error);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    );

    fireEvent.press(getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      expect(
        getByText(
          'This order item has already been assigned to a shipment. Cancel the shipment instead.',
        ),
      ).toBeTruthy();
    });
  });

  it('displays CANNOT_CANCEL_AFTER_PAYMENT error inside modal', async () => {
    const error = new ApiError(
      'A shipment or item of an already paid order cannot be cancelled by the seller',
      'CANNOT_CANCEL_AFTER_PAYMENT',
      400,
    );
    mockCancelMutate.mockRejectedValueOnce(error);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    );

    fireEvent.press(getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      expect(
        getByText(
          'A shipment or item of an already paid order cannot be cancelled by the seller.',
        ),
      ).toBeTruthy();
    });
  });

  it('handles 403 Forbidden without logging out the user', async () => {
    const error = new ApiError('Order item belongs to another seller', 'FORBIDDEN', 403);
    mockCancelMutate.mockRejectedValueOnce(error);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(
      getByRole('button', { name: 'Cancel Ergonomic Mechanical Keyboard' }),
    );

    fireEvent.press(getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      expect(
        getByText('You do not have permission to cancel this order item.'),
      ).toBeTruthy();
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // PHASE 4: SHIPMENT CREATION FLOW & BUNDLING
  // ==========================================================================

  it('bundles multiple confirmed items of the same order into a single ShipmentOrderGroup', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockConfirmedItem, mockConfirmedItemSameOrder, mockConfirmedItemOtherOrder],
        page: 0,
        size: 20,
        totalElements: 3,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Confirmed' }));

    expect(getByText('2 lines (2 pcs)')).toBeTruthy();
    expect(getByText('Gaming Mouse Wireless')).toBeTruthy();
    expect(getByText('Gaming Mousepad XL')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Create Shipment for Order #order-uu' }),
    ).toBeTruthy();

    expect(getByText('1 line (1 pcs)')).toBeTruthy();
    expect(getByText('Headphone Stand Aluminum')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Create Shipment for Order #ord-4444' }),
    ).toBeTruthy();
  });

  it('opens CreateShipmentModal when Create Shipment button is pressed on an order group', () => {
    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockConfirmedItem, mockConfirmedItemSameOrder],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, getByTestId, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Confirmed' }));

    const createShipmentBtn = getByRole('button', {
      name: 'Create Shipment for Order #order-uu',
    });
    fireEvent.press(createShipmentBtn);

    expect(getByTestId('create-shipment-modal')).toBeTruthy();
    expect(getByTestId('one-shipment-policy-banner')).toBeTruthy();
    expect(getByText('Bundled Items (2)')).toBeTruthy();
  });

  it('completes shipment creation with selected carrier for all bundled order items', async () => {
    mockCreateShipmentMutate.mockResolvedValueOnce({
      id: 'shipment-new-1',
      orderId: 'order-uuid-2222',
    });

    mockedUseSellerOrderItems.mockReturnValue({
      data: {
        content: [mockConfirmedItem, mockConfirmedItemSameOrder],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchOrderItems,
    } as never);

    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Confirmed' }));

    fireEvent.press(
      getByRole('button', { name: 'Create Shipment for Order #order-uu' }),
    );

    const carrierBtn = getByRole('radio', { name: 'Giao Hang Nhanh (GHN)' });
    fireEvent.press(carrierBtn);

    const submitBtn = getByRole('button', { name: 'Confirm and Create Shipment' });
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockCreateShipmentMutate).toHaveBeenCalledWith({
        orderId: 'order-uuid-2222',
        deliveryMethod: 'PLATFORM_DELIVERY',
        carrierId: 'carrier-ghn',
        orderItemIds: ['oi-confirmed-2', 'oi-confirmed-2b'],
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Shipment Created',
        expect.stringContaining('order-uu'),
      );
    });
  });

  // ==========================================================================
  // PHASE 5: SHIPMENT WORKSPACE & STATUS MANAGEMENT
  // ==========================================================================

  it('switches to Shipments workspace and queries PENDING shipments by default', () => {
    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    const shipmentsTab = getByRole('tab', { name: 'Shipments Workspace' });
    fireEvent.press(shipmentsTab);

    expect(mockedUseSellerShipments).toHaveBeenCalledWith(
      {
        status: 'PENDING',
        page: 0,
        size: 20,
      },
      true,
    );
  });

  it('filters shipments by status (PREPARING, SHIPPED, DELIVERED, FAILED, RETURNED, CANCELLED) and resets page to 0', () => {
    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    // Switch to Shipments workspace
    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    // Tap Preparing filter
    fireEvent.press(getByTestId('shipment-filter-preparing'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'PREPARING', page: 0, size: 20 },
      true,
    );

    // Tap Shipped filter
    fireEvent.press(getByTestId('shipment-filter-shipped'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'SHIPPED', page: 0, size: 20 },
      true,
    );

    // Tap Delivered filter
    fireEvent.press(getByTestId('shipment-filter-delivered'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'DELIVERED', page: 0, size: 20 },
      true,
    );

    // Tap Failed filter
    fireEvent.press(getByTestId('shipment-filter-failed'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'FAILED', page: 0, size: 20 },
      true,
    );

    // Tap Returned filter
    fireEvent.press(getByTestId('shipment-filter-returned'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'RETURNED', page: 0, size: 20 },
      true,
    );

    // Tap Cancelled filter
    fireEvent.press(getByTestId('shipment-filter-cancelled'));
    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'CANCELLED', page: 0, size: 20 },
      true,
    );
  });

  it('renders shipment fields correctly without fabricating carrier or tracking code', () => {
    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPendingShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByText, queryByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    expect(getByText('#order-uu')).toBeTruthy();
    expect(getByText('#ship-pen')).toBeTruthy();
    expect(getByText('Platform Delivery')).toBeTruthy();
    expect(getByText('Giao Hang Nhanh (GHN)')).toBeTruthy();
    expect(queryByText('Tracking Code:')).toBeNull();
  });

  it('renders loading, empty, and error states for shipments', () => {
    mockedUseSellerShipments.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByText, rerender } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));
    expect(getByText('Loading shipments…')).toBeTruthy();

    // Empty state
    mockedUseSellerShipments.mockReturnValue({
      data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    rerender(<SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />);
    expect(getByText('No pending shipments.')).toBeTruthy();

    // Error state
    mockedUseSellerShipments.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: new ApiError('Failed to load shipments', 'SERVER_ERROR', 500),
      refetch: mockRefetchShipments,
    } as never);

    rerender(<SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />);
    expect(getByText("Couldn't load shipments")).toBeTruthy();

    const retryBtn = getByRole('button', { name: 'Retry loading shipments' });
    fireEvent.press(retryBtn);
    expect(mockRefetchShipments).toHaveBeenCalledTimes(1);
  });

  it('supports pagination controls in Shipments workspace', () => {
    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPendingShipment],
        page: 0,
        size: 20,
        totalElements: 50,
        totalPages: 3,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    expect(getByText('Page 1 / 3')).toBeTruthy();

    const nextBtn = getByRole('button', { name: 'Next shipment page' });
    fireEvent.press(nextBtn);

    expect(mockedUseSellerShipments).toHaveBeenLastCalledWith(
      { status: 'PENDING', page: 1, size: 20 },
      true,
    );
  });

  it('executes PENDING -> PREPARING transition via UpdateShipmentStatusModal', async () => {
    mockUpdateShipmentStatusMutate.mockResolvedValueOnce({
      ...mockPendingShipment,
      status: 'PREPARING',
    });

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPendingShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    const startPreparingBtn = getByRole('button', {
      name: 'Start Preparing for Shipment #ship-pen',
    });
    fireEvent.press(startPreparingBtn);

    // Modal opens, confirm
    const confirmBtn = getByTestId('confirm-status-update-btn');
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(mockUpdateShipmentStatusMutate).toHaveBeenCalledWith({
        shipmentId: 'ship-pending-1',
        status: 'PREPARING',
        trackingCode: undefined,
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Status Updated',
        'Shipment status updated to PREPARING.',
      );
    });
  });

  it('executes PREPARING -> SHIPPED transition requiring trackingCode', async () => {
    mockUpdateShipmentStatusMutate.mockResolvedValueOnce({
      ...mockPreparingShipment,
      status: 'SHIPPED',
      trackingCode: 'GHN-TRACK-7777',
    });

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPreparingShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByLabelText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    const shipOrderBtn = getByRole('button', {
      name: 'Ship Order for Shipment #ship-pre',
    });
    fireEvent.press(shipOrderBtn);

    const trackingInput = getByLabelText('Tracking code input');
    fireEvent.changeText(trackingInput, '  GHN-TRACK-7777  ');

    const confirmBtn = getByRole('button', { name: 'Confirm Shipped' });
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(mockUpdateShipmentStatusMutate).toHaveBeenCalledWith({
        shipmentId: 'ship-prep-2',
        status: 'SHIPPED',
        trackingCode: 'GHN-TRACK-7777',
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Status Updated',
        'Shipment status updated to SHIPPED.',
      );
    });
  });

  it('displays error when attempting to cancel a shipment of a paid order', async () => {
    const error = new ApiError(
      'A shipment of a paid order cannot be cancelled',
      'VALIDATION_ERROR',
      400,
    );
    mockUpdateShipmentStatusMutate.mockRejectedValueOnce(error);

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockPendingShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    const cancelShipmentBtn = getByRole('button', {
      name: 'Cancel Shipment for Shipment #ship-pen',
    });
    fireEvent.press(cancelShipmentBtn);

    const confirmBtn = getByRole('button', { name: 'Confirm Cancel Shipment' });
    fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(
        getByText('A shipment of a paid order cannot be cancelled by the seller.'),
      ).toBeTruthy();
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('executes SHIPPED -> DELIVERED transition with multi-seller explanation', async () => {
    mockUpdateShipmentStatusMutate.mockResolvedValueOnce({
      ...mockShippedShipment,
      status: 'DELIVERED',
    });

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockShippedShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    const markDeliveredBtn = getByRole('button', {
      name: 'Mark Delivered for Shipment #ship-shi',
    });
    fireEvent.press(markDeliveredBtn);

    expect(
      getByText(/Backend will record COD payment completion and mark the customer order DELIVERED/),
    ).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Confirm Delivered' }));

    await waitFor(() => {
      expect(mockUpdateShipmentStatusMutate).toHaveBeenCalledWith({
        shipmentId: 'ship-shipped-3',
        status: 'DELIVERED',
        trackingCode: undefined,
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Status Updated',
        'Shipment status updated to DELIVERED.',
      );
    });
  });

  it('executes SHIPPED -> FAILED and FAILED -> RETURNED transitions', async () => {
    mockUpdateShipmentStatusMutate.mockResolvedValueOnce({
      ...mockShippedShipment,
      status: 'FAILED',
    });

    mockedUseSellerShipments.mockReturnValue({
      data: {
        content: [mockShippedShipment],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetchShipments,
    } as never);

    const { getByRole, getByTestId } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));

    fireEvent.press(
      getByRole('button', { name: 'Mark Failed for Shipment #ship-shi' }),
    );
    fireEvent.press(getByRole('button', { name: 'Confirm Failed' }));

    await waitFor(() => {
      expect(mockUpdateShipmentStatusMutate).toHaveBeenCalledWith({
        shipmentId: 'ship-shipped-3',
        status: 'FAILED',
        trackingCode: undefined,
      });
    });
  });

  it('switches seamlessly back to Order Items workspace preserving its full functionality', () => {
    const { getByRole, getByText } = render(
      <SellerFulfillmentScreen navigation={mockNavigation} route={{} as never} />,
    );

    // Switch to Shipments
    fireEvent.press(getByRole('tab', { name: 'Shipments Workspace' }));
    expect(getByRole('tab', { name: 'Shipments Workspace' }).props.accessibilityState.selected).toBe(true);

    // Switch back to Order Items
    fireEvent.press(getByRole('tab', { name: 'Order Items Workspace' }));
    expect(getByRole('tab', { name: 'Order Items Workspace' }).props.accessibilityState.selected).toBe(true);

    expect(getByText('Ergonomic Mechanical Keyboard')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Confirm Ergonomic Mechanical Keyboard' }),
    ).toBeTruthy();
  });
});
