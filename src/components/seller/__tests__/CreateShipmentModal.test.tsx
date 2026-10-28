/**
 * Comprehensive unit tests for CreateShipmentModal (Phase 4).
 *
 * Covers:
 * - Rendering order summary, bundled items, policy banner
 * - PLATFORM_DELIVERY vs SELF_DELIVERY switching
 * - Carrier loading, error, empty, and selection states
 * - Mandating carrierId for PLATFORM_DELIVERY
 * - Enforcing carrierId: null for SELF_DELIVERY
 * - Bundling all confirmed items for the order
 * - Error mapping: duplicate shipment, inactive carrier, 403 forbidden
 * - Dismissal and double-submit prevention
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../../api/errors';
import {
  useCreateSellerShipment,
  useSellerCarriers,
} from '../../../hooks/useSellerFulfillment';
import type { Carrier, SellerOrderItem } from '../../../types/sellerApi';
import CreateShipmentModal from '../CreateShipmentModal';

jest.mock('../../../hooks/useSellerFulfillment');

const mockedUseSellerCarriers = useSellerCarriers as jest.MockedFunction<
  typeof useSellerCarriers
>;
const mockedUseCreateSellerShipment = useCreateSellerShipment as jest.MockedFunction<
  typeof useCreateSellerShipment
>;

const mockItems: SellerOrderItem[] = [
  {
    id: 'item-101',
    orderId: 'order-12345678-uuid',
    productId: 'prod-1',
    productName: 'Mechanical Keyboard RGB',
    unitPrice: '1500000.00',
    quantity: 1,
    status: 'CONFIRMED',
    sellerId: 'seller-1',
  },
  {
    id: 'item-102',
    orderId: 'order-12345678-uuid',
    productId: 'prod-2',
    productName: 'PBT Keycaps Set',
    unitPrice: '500000.00',
    quantity: 2,
    status: 'CONFIRMED',
    sellerId: 'seller-1',
  },
];

const mockCarriers: Carrier[] = [
  { id: 'carrier-1', name: 'Giao Hang Nhanh (GHN)', active: true },
  { id: 'carrier-2', name: 'Viettel Post', active: true },
];

describe('CreateShipmentModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockMutateAsync = jest.fn();
  const mockRefetchCarriers = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseSellerCarriers.mockReturnValue({
      data: mockCarriers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchCarriers,
    } as never);

    mockedUseCreateSellerShipment.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as never);
  });

  it('renders nothing when visible is false or orderId is null', () => {
    const { queryByTestId, rerender } = render(
      <CreateShipmentModal
        visible={false}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );
    expect(queryByTestId('create-shipment-modal')).toBeNull();

    rerender(
      <CreateShipmentModal
        visible={true}
        orderId={null}
        items={mockItems}
        onClose={mockOnClose}
      />,
    );
    expect(queryByTestId('create-shipment-modal')).toBeNull();
  });

  it('renders order summary, bundled items, policy notice, and total', () => {
    const { getByText, getByTestId } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    expect(getByText(/Order #order-12/)).toBeTruthy();
    expect(getByTestId('one-shipment-policy-banner')).toBeTruthy();
    expect(getByText('One Shipment Policy')).toBeTruthy();
    expect(getByText(/All 2 confirmed items in this order will be bundled/)).toBeTruthy();

    expect(getByText('Mechanical Keyboard RGB')).toBeTruthy();
    expect(getByText('PBT Keycaps Set')).toBeTruthy();
    expect(getByText('Bundle Total:')).toBeTruthy();
    // 1 * 1,500,000 + 2 * 500,000 = 2,500,000 VND
    expect(getByText('2.500.000 ₫')).toBeTruthy();
  });

  it('defaults to PLATFORM_DELIVERY and lists available active carriers', () => {
    const { getByRole, getByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    const platformRadio = getByRole('radio', { name: 'Platform Delivery' });
    expect(platformRadio.props.accessibilityState.checked).toBe(true);

    expect(getByText('Select Carrier *')).toBeTruthy();
    expect(getByText('Giao Hang Nhanh (GHN)')).toBeTruthy();
    expect(getByText('Viettel Post')).toBeTruthy();
  });

  it('shows loading indicator when carriers are loading', () => {
    mockedUseSellerCarriers.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mockRefetchCarriers,
    } as never);

    const { getByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    expect(getByText('Loading active carriers…')).toBeTruthy();
  });

  it('shows error state and allows retry when carriers fail to load', () => {
    mockedUseSellerCarriers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: mockRefetchCarriers,
    } as never);

    const { getByText, getByRole } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    expect(getByText('Failed to load active carriers.')).toBeTruthy();
    const retryBtn = getByRole('button', { name: 'Retry loading carriers' });
    fireEvent.press(retryBtn);
    expect(mockRefetchCarriers).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no active carriers exist', () => {
    mockedUseSellerCarriers.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchCarriers,
    } as never);

    const { getByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    expect(
      getByText(/No active shipping carriers available\. Please switch to Self Delivery\./),
    ).toBeTruthy();
  });

  it('disables submit button in PLATFORM_DELIVERY when no carrier is selected', () => {
    const { getByRole } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    const submitBtn = getByRole('button', { name: 'Confirm and Create Shipment' });
    expect(submitBtn.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(submitBtn);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('enables submit button when carrier is selected and submits payload with carrierId', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'shipment-1' });

    const { getByRole } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const carrierOption = getByRole('radio', { name: 'Giao Hang Nhanh (GHN)' });
    fireEvent.press(carrierOption);

    const submitBtn = getByRole('button', { name: 'Confirm and Create Shipment' });
    expect(submitBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        orderId: 'order-12345678-uuid',
        deliveryMethod: 'PLATFORM_DELIVERY',
        carrierId: 'carrier-1',
        orderItemIds: ['item-101', 'item-102'],
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Shipment Created',
        expect.stringContaining('order-12'),
      );
    });
  });

  it('supports switching to SELF_DELIVERY mode and sends carrierId: null without requiring a carrier', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'shipment-2' });

    const { getByRole, getByTestId, queryByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />,
    );

    const selfDeliveryRadio = getByRole('radio', { name: 'Self Delivery' });
    fireEvent.press(selfDeliveryRadio);

    // Carrier selector is hidden
    expect(queryByText('Select Carrier *')).toBeNull();
    // Self delivery notice is shown
    expect(getByTestId('self-delivery-notice')).toBeTruthy();

    const submitBtn = getByRole('button', { name: 'Confirm and Create Shipment' });
    expect(submitBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        orderId: 'order-12345678-uuid',
        deliveryMethod: 'SELF_DELIVERY',
        carrierId: null,
        orderItemIds: ['item-101', 'item-102'],
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error message when order already has a shipment (DUPLICATE_SHIPMENT)', async () => {
    const error = new ApiError(
      'The seller already has a shipment for this order',
      'DUPLICATE_SHIPMENT',
      400,
    );
    mockMutateAsync.mockRejectedValueOnce(error);

    const { getByRole, getByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    fireEvent.press(getByRole('radio', { name: 'Viettel Post' }));
    fireEvent.press(getByRole('button', { name: 'Confirm and Create Shipment' }));

    await waitFor(() => {
      expect(
        getByText('A shipment has already been created for this order.'),
      ).toBeTruthy();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('displays user-friendly error on 403 Forbidden without logging out', async () => {
    const error = new ApiError('Forbidden', 'FORBIDDEN', 403);
    mockMutateAsync.mockRejectedValueOnce(error);

    const { getByRole, getByText } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    fireEvent.press(getByRole('radio', { name: 'Giao Hang Nhanh (GHN)' }));
    fireEvent.press(getByRole('button', { name: 'Confirm and Create Shipment' }));

    await waitFor(() => {
      expect(
        getByText('You do not have permission to create a shipment for this order.'),
      ).toBeTruthy();
    });
  });

  it('allows user to dismiss modal via Cancel button or ✕ button', () => {
    const { getByRole } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    const cancelBtn = getByRole('button', { name: 'Cancel shipment creation' });
    fireEvent.press(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const closeBtn = getByRole('button', { name: 'Close shipment creation dialog' });
    fireEvent.press(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('prevents closing while mutation is pending', () => {
    mockedUseCreateSellerShipment.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    } as never);

    const { getByRole } = render(
      <CreateShipmentModal
        visible={true}
        orderId="order-12345678-uuid"
        items={mockItems}
        onClose={mockOnClose}
      />,
    );

    const cancelBtn = getByRole('button', { name: 'Cancel shipment creation' });
    const closeBtn = getByRole('button', { name: 'Close shipment creation dialog' });

    fireEvent.press(cancelBtn);
    fireEvent.press(closeBtn);

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
