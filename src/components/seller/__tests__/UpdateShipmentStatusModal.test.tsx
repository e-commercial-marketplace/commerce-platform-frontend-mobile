/**
 * Unit tests for UpdateShipmentStatusModal (Phase 5).
 *
 * Covers:
 * - Gating when visible=false, shipment=null, or targetStatus=null
 * - PREPARING transition
 * - SHIPPED transition requiring non-blank trackingCode
 * - Preserving entered trackingCode on failed submission
 * - CANCELLED transition with warning notice
 * - DELIVERED transition with multi-seller explanation
 * - FAILED transition
 * - RETURNED transition
 * - Displaying backend error message
 * - Preventing dismissal while in-flight
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { SellerShipment } from '../../../types/sellerApi';
import UpdateShipmentStatusModal from '../UpdateShipmentStatusModal';

const mockShipment: SellerShipment = {
  id: 'shipment-1234-uuid',
  orderId: 'order-5678-uuid',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-1', name: 'Fast Delivery' },
  status: 'PENDING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'item-1', quantity: 2 }],
};

describe('UpdateShipmentStatusModal', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when visible is false or shipment/targetStatus is null', () => {
    const { queryByTestId, rerender } = render(
      <UpdateShipmentStatusModal
        visible={false}
        shipment={mockShipment}
        targetStatus="PREPARING"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(queryByTestId('update-shipment-status-modal')).toBeNull();

    rerender(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={null}
        targetStatus="PREPARING"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(queryByTestId('update-shipment-status-modal')).toBeNull();

    rerender(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={mockShipment}
        targetStatus={null}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );
    expect(queryByTestId('update-shipment-status-modal')).toBeNull();
  });

  it('handles PREPARING transition: renders prompt and confirms without tracking code', () => {
    const { getAllByText, getByText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={mockShipment}
        targetStatus="PREPARING"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(getAllByText('Start Preparing').length).toBeGreaterThanOrEqual(1);
    expect(
      getByText(/Move this shipment to the PREPARING stage/),
    ).toBeTruthy();

    const confirmBtn = getByRole('button', { name: 'Start Preparing' });
    fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith('shipment-1234-uuid', 'PREPARING');
  });

  it('handles SHIPPED transition: requires tracking code and trims whitespace before submit', () => {
    const { getByLabelText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'PREPARING' }}
        targetStatus="SHIPPED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    const submitBtn = getByRole('button', { name: 'Confirm Shipped' });
    // Button is disabled when input is blank
    expect(submitBtn.props.accessibilityState.disabled).toBe(true);

    const trackingInput = getByLabelText('Tracking code input');
    fireEvent.changeText(trackingInput, '   ');
    expect(submitBtn.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(trackingInput, '  VN-SHIP-9999  ');
    expect(submitBtn.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(submitBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith(
      'shipment-1234-uuid',
      'SHIPPED',
      'VN-SHIP-9999',
    );
  });

  it('preserves user-entered tracking code when errorMessage is passed', () => {
    const { getByLabelText, getByText, rerender } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'PREPARING' }}
        targetStatus="SHIPPED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    const trackingInput = getByLabelText('Tracking code input');
    fireEvent.changeText(trackingInput, 'VN-FAILED-CODE');

    // Simulate failed mutation with error message
    rerender(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'PREPARING' }}
        targetStatus="SHIPPED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        errorMessage="Invalid tracking code format"
      />,
    );

    expect(getByText('Invalid tracking code format')).toBeTruthy();
    expect(trackingInput.props.value).toBe('VN-FAILED-CODE');
  });

  it('handles CANCELLED transition: renders warning prompt and confirms', () => {
    const { getByText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={mockShipment}
        targetStatus="CANCELLED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(getByText('Cancel Entire Shipment')).toBeTruthy();
    expect(getByText(/All 1 bundled order items will be cancelled/)).toBeTruthy();
    expect(getByText(/strictly forbids seller cancellation for paid orders/)).toBeTruthy();

    const confirmBtn = getByRole('button', { name: 'Confirm Cancel Shipment' });
    fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith('shipment-1234-uuid', 'CANCELLED');
  });

  it('handles DELIVERED transition with multi-seller order aggregation notice', () => {
    const { getByText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'SHIPPED', trackingCode: 'TRK123' }}
        targetStatus="DELIVERED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(getByText('Confirm Delivery')).toBeTruthy();
    expect(
      getByText(/Backend will record COD payment completion and mark the customer order DELIVERED/),
    ).toBeTruthy();

    const confirmBtn = getByRole('button', { name: 'Confirm Delivered' });
    fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith('shipment-1234-uuid', 'DELIVERED');
  });

  it('handles FAILED transition: renders warning prompt and confirms', () => {
    const { getByText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'SHIPPED', trackingCode: 'TRK123' }}
        targetStatus="FAILED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(getByText('Mark Delivery as Failed')).toBeTruthy();

    const confirmBtn = getByRole('button', { name: 'Confirm Failed' });
    fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith('shipment-1234-uuid', 'FAILED');
  });

  it('handles RETURNED transition: renders stock return explanation and confirms', () => {
    const { getByText, getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={{ ...mockShipment, status: 'FAILED' }}
        targetStatus="RETURNED"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(getByText('Confirm Items Returned')).toBeTruthy();
    expect(
      getByText(/Backend will automatically restore inventory stock/),
    ).toBeTruthy();

    const confirmBtn = getByRole('button', { name: 'Confirm Returned' });
    fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith('shipment-1234-uuid', 'RETURNED');
  });

  it('allows dismiss via Cancel button or ✕ button', () => {
    const { getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={mockShipment}
        targetStatus="PREPARING"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

    const cancelBtn = getByRole('button', { name: 'Cancel status update' });
    fireEvent.press(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const closeBtn = getByRole('button', { name: 'Close status update modal' });
    fireEvent.press(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('prevents dismissal while isSubmitting is true', () => {
    const { getByRole } = render(
      <UpdateShipmentStatusModal
        visible={true}
        shipment={mockShipment}
        targetStatus="PREPARING"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        isSubmitting={true}
      />,
    );

    const cancelBtn = getByRole('button', { name: 'Cancel status update' });
    const closeBtn = getByRole('button', { name: 'Close status update modal' });

    fireEvent.press(cancelBtn);
    fireEvent.press(closeBtn);

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
