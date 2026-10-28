/**
 * Unit tests for ShipmentOrderGroup (Phase 4).
 *
 * Verifies:
 * - Grouping of confirmed items by orderId
 * - Line item rendering (name, qty, unitPrice, lineTotal)
 * - Bundle total calculation
 * - "Create Shipment" trigger passing (orderId, items)
 * - Individual item cancellation trigger passing the item
 * - Disabled state propagation
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { SellerOrderItem } from '../../../types/sellerApi';
import ShipmentOrderGroup from '../ShipmentOrderGroup';

const mockOrderItems: SellerOrderItem[] = [
  {
    id: 'item-1',
    orderId: 'order-uuid-9999-aaaa-bbbb',
    productId: 'prod-1',
    productName: 'Mechanical Keyboard RGB',
    unitPrice: '1200000.00',
    quantity: 2,
    status: 'CONFIRMED',
    sellerId: 'seller-1',
  },
  {
    id: 'item-2',
    orderId: 'order-uuid-9999-aaaa-bbbb',
    productId: 'prod-2',
    productName: 'Keycap Puller Tool',
    unitPrice: '50000.00',
    quantity: 1,
    status: 'CONFIRMED',
    sellerId: 'seller-1',
  },
];

describe('ShipmentOrderGroup', () => {
  const mockOnCreateShipment = jest.fn();
  const mockOnCancelItem = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders order header with truncated order reference and badge', () => {
    const { getByText } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
      />,
    );

    expect(getByText('#order-uu')).toBeTruthy();
    expect(getByText('2 lines (3 pcs)')).toBeTruthy();
  });

  it('renders each bundled line item with quantity, unitPrice and line total', () => {
    const { getByText } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
      />,
    );

    expect(getByText('Mechanical Keyboard RGB')).toBeTruthy();
    expect(getByText(/Qty: 2 • 1\.200\.000 ₫ = 2\.400\.000 ₫/)).toBeTruthy();

    expect(getByText('Keycap Puller Tool')).toBeTruthy();
    expect(getByText(/Qty: 1 • 50\.000 ₫ = 50\.000 ₫/)).toBeTruthy();
  });

  it('calculates bundle total correctly (2 * 1,200,000 + 1 * 50,000 = 2,450,000 VND)', () => {
    const { getByText } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
      />,
    );

    expect(getByText('2.450.000 ₫')).toBeTruthy();
  });

  it('triggers onCreateShipment with orderId and items bundle on button press', () => {
    const { getByRole } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
      />,
    );

    const createBtn = getByRole('button', {
      name: 'Create Shipment for Order #order-uu',
    });
    fireEvent.press(createBtn);

    expect(mockOnCreateShipment).toHaveBeenCalledTimes(1);
    expect(mockOnCreateShipment).toHaveBeenCalledWith(
      'order-uuid-9999-aaaa-bbbb',
      mockOrderItems,
    );
  });

  it('triggers onCancelItem when an individual line item cancel button is pressed', () => {
    const { getByRole } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
      />,
    );

    const cancelBtn = getByRole('button', {
      name: 'Cancel Keycap Puller Tool',
    });
    fireEvent.press(cancelBtn);

    expect(mockOnCancelItem).toHaveBeenCalledTimes(1);
    expect(mockOnCancelItem).toHaveBeenCalledWith(mockOrderItems[1]);
  });

  it('disables buttons when disabled prop is true', () => {
    const { getByRole } = render(
      <ShipmentOrderGroup
        orderId="order-uuid-9999-aaaa-bbbb"
        items={mockOrderItems}
        onCreateShipment={mockOnCreateShipment}
        onCancelItem={mockOnCancelItem}
        disabled={true}
      />,
    );

    const createBtn = getByRole('button', {
      name: 'Create Shipment for Order #order-uu',
    });
    const cancelBtn = getByRole('button', {
      name: 'Cancel Mechanical Keyboard RGB',
    });

    fireEvent.press(createBtn);
    fireEvent.press(cancelBtn);

    expect(mockOnCreateShipment).not.toHaveBeenCalled();
    expect(mockOnCancelItem).not.toHaveBeenCalled();
  });
});
