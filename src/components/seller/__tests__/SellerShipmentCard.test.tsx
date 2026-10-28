/**
 * Unit tests for SellerShipmentCard (Phase 5).
 *
 * Verifies:
 * - Shipment & order reference rendering
 * - Status badge rendering
 * - Platform delivery carrier vs Self delivery (no fake carrier)
 * - Tracking code present vs null (no fake tracking code)
 * - ShippedAt & DeliveredAt timestamps
 * - Line items list with quantity
 * - Allowed NEXT actions strictly matching backend state machine
 * - Terminal states (DELIVERED, RETURNED, CANCELLED) show no actions
 * - Calling onUpdateStatus with exact targetStatus
 * - Propagation of disabled state
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { SellerShipment } from '../../../types/sellerApi';
import SellerShipmentCard from '../SellerShipmentCard';

const mockBaseShipment: SellerShipment = {
  id: 'ship-1111-2222-3333-4444',
  orderId: 'order-aaaa-bbbb-cccc-dddd',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-ghn', name: 'Giao Hang Nhanh (GHN)' },
  status: 'PENDING',
  trackingCode: null,
  shippingFee: '0.00',
  shippedAt: null,
  deliveredAt: null,
  items: [
    { orderItemId: 'oi-1111-item-1', quantity: 2 },
    { orderItemId: 'oi-2222-item-2', quantity: 1 },
  ],
};

describe('SellerShipmentCard', () => {
  const mockOnUpdateStatus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order reference, shipment reference, and status badge', () => {
    const { getByText } = render(
      <SellerShipmentCard
        shipment={mockBaseShipment}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(getByText('#order-aa')).toBeTruthy();
    expect(getByText('#ship-111')).toBeTruthy();
    expect(getByText('Pending')).toBeTruthy();
  });

  it('renders Platform Delivery with carrier name for PLATFORM_DELIVERY', () => {
    const { getByText } = render(
      <SellerShipmentCard
        shipment={mockBaseShipment}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(getByText('Platform Delivery')).toBeTruthy();
    expect(getByText('Giao Hang Nhanh (GHN)')).toBeTruthy();
  });

  it('renders Shop Self Delivery without fabricating a carrier for SELF_DELIVERY', () => {
    const selfShipment: SellerShipment = {
      ...mockBaseShipment,
      deliveryMethod: 'SELF_DELIVERY',
      carrier: null,
    };

    const { getByText, queryByText } = render(
      <SellerShipmentCard
        shipment={selfShipment}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(getByText('Shop Self Delivery')).toBeTruthy();
    expect(queryByText('Carrier:')).toBeNull();
    expect(queryByText('Giao Hang Nhanh (GHN)')).toBeNull();
  });

  it('renders tracking code when present, and does NOT fabricate when null', () => {
    const { queryByText, rerender } = render(
      <SellerShipmentCard
        shipment={mockBaseShipment}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );
    expect(queryByText('Tracking Code:')).toBeNull();

    const shipmentWithTracking: SellerShipment = {
      ...mockBaseShipment,
      status: 'SHIPPED',
      trackingCode: 'GHN88889999VN',
      shippedAt: '2026-10-28T10:00:00Z',
    };

    rerender(
      <SellerShipmentCard
        shipment={shipmentWithTracking}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(queryByText('Tracking Code:')).toBeTruthy();
    expect(queryByText('GHN88889999VN')).toBeTruthy();
    expect(queryByText('Shipped At:')).toBeTruthy();
  });

  it('renders line items with truncated item id and quantity', () => {
    const { getByText } = render(
      <SellerShipmentCard
        shipment={mockBaseShipment}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(getByText(/Bundled Items \(2 lines, 3 pcs\)/)).toBeTruthy();
    expect(getByText('Item #oi-1111-')).toBeTruthy();
    expect(getByText('Item #oi-2222-')).toBeTruthy();
    expect(getByText('Qty: 2')).toBeTruthy();
    expect(getByText('Qty: 1')).toBeTruthy();
  });

  // ==========================================================================
  // STATE MACHINE & ALLOWED NEXT ACTIONS
  // ==========================================================================

  it('for PENDING: renders "Start Preparing" and "Cancel Shipment"', () => {
    const { getByRole, queryByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'PENDING' }}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(
      getByRole('button', { name: 'Start Preparing for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(
      getByRole('button', { name: 'Cancel Shipment for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(queryByRole('button', { name: /Ship Order/ })).toBeNull();
    expect(queryByRole('button', { name: /Mark Delivered/ })).toBeNull();
  });

  it('for PREPARING: renders "Ship Order" and "Cancel Shipment"', () => {
    const { getByRole, queryByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'PREPARING' }}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(
      getByRole('button', { name: 'Ship Order for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(
      getByRole('button', { name: 'Cancel Shipment for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(queryByRole('button', { name: /Start Preparing/ })).toBeNull();
    expect(queryByRole('button', { name: /Mark Delivered/ })).toBeNull();
  });

  it('for SHIPPED: renders "Mark Delivered" and "Mark Failed"', () => {
    const { getByRole, queryByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'SHIPPED', trackingCode: 'TRK123' }}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(
      getByRole('button', { name: 'Mark Delivered for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(
      getByRole('button', { name: 'Mark Failed for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(queryByRole('button', { name: /Ship Order/ })).toBeNull();
    expect(queryByRole('button', { name: /Cancel Shipment/ })).toBeNull();
  });

  it('for FAILED: renders "Mark Returned"', () => {
    const { getByRole, queryByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'FAILED' }}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    expect(
      getByRole('button', { name: 'Mark Returned for Shipment #ship-111' }),
    ).toBeTruthy();
    expect(queryByRole('button', { name: /Mark Delivered/ })).toBeNull();
    expect(queryByRole('button', { name: /Cancel Shipment/ })).toBeNull();
  });

  it('for terminal states (DELIVERED, RETURNED, CANCELLED): renders NO action buttons', () => {
    const terminalStatuses: SellerShipment['status'][] = [
      'DELIVERED',
      'RETURNED',
      'CANCELLED',
    ];

    for (const status of terminalStatuses) {
      const { queryByRole } = render(
        <SellerShipmentCard
          shipment={{ ...mockBaseShipment, status }}
          onUpdateStatus={mockOnUpdateStatus}
        />,
      );

      expect(queryByRole('button')).toBeNull();
    }
  });

  it('triggers onUpdateStatus when an allowed action button is pressed', () => {
    const { getByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'PENDING' }}
        onUpdateStatus={mockOnUpdateStatus}
      />,
    );

    const startPreparingBtn = getByRole('button', {
      name: 'Start Preparing for Shipment #ship-111',
    });
    fireEvent.press(startPreparingBtn);

    expect(mockOnUpdateStatus).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ship-1111-2222-3333-4444' }),
      'PREPARING',
    );
  });

  it('disables buttons when disabled prop is true', () => {
    const { getByRole } = render(
      <SellerShipmentCard
        shipment={{ ...mockBaseShipment, status: 'PENDING' }}
        onUpdateStatus={mockOnUpdateStatus}
        disabled={true}
      />,
    );

    const startPreparingBtn = getByRole('button', {
      name: 'Start Preparing for Shipment #ship-111',
    });
    fireEvent.press(startPreparingBtn);

    expect(mockOnUpdateStatus).not.toHaveBeenCalled();
  });
});
