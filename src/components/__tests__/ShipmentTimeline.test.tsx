import React from 'react';
import { render } from '@testing-library/react-native';

import { ShipmentTimeline } from '../ShipmentTimeline';
import type { OrderItemResponse, ShipmentResponse } from '../../types/orderApi';

const baseShipment: ShipmentResponse = {
  id: 'ship-1',
  orderId: 'order-1',
  sellerId: 'seller-1',
  deliveryMethod: 'PLATFORM_DELIVERY',
  carrier: { id: 'carrier-1', name: 'Giao Hang Nhanh' },
  status: 'PENDING',
  trackingCode: 'GHN123',
  shippingFee: '15000.00',
  shippedAt: null,
  deliveredAt: null,
  items: [{ orderItemId: 'oi-1', quantity: 2 }],
};

const mockOrderItems: OrderItemResponse[] = [
  {
    id: 'oi-1',
    orderId: 'order-1',
    productId: 'prod-1',
    productName: 'Mechanical Keyboard',
    unitPrice: '150000.00',
    quantity: 2,
    status: 'CONFIRMED',
    sellerId: 'seller-1',
  },
  {
    id: 'oi-2',
    orderId: 'order-1',
    productId: 'prod-2',
    productName: 'Gaming Mouse',
    unitPrice: '80000.00',
    quantity: 1,
    status: 'CONFIRMED',
    sellerId: 'seller-2',
  },
];

describe('ShipmentTimeline', () => {
  it('renders PENDING state without fake timestamps', () => {
    const { getByText, queryAllByText } = render(
      <ShipmentTimeline
        shipment={{ ...baseShipment, status: 'PENDING' }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(getByText('Shipment 1')).toBeTruthy();
    expect(queryAllByText('PENDING').length).toBeGreaterThan(0);
    expect(queryAllByText('PREPARING').length).toBeGreaterThan(0);
    expect(queryAllByText('SHIPPED').length).toBeGreaterThan(0);
    expect(queryAllByText('DELIVERED').length).toBeGreaterThan(0);
    expect(queryAllByText(/2026/).length).toBe(0);
  });

  it('renders PREPARING state with progression', () => {
    const { queryAllByText } = render(
      <ShipmentTimeline
        shipment={{ ...baseShipment, status: 'PREPARING' }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(queryAllByText('PREPARING').length).toBeGreaterThan(0);
    expect(queryAllByText('PENDING').length).toBeGreaterThan(0);
  });

  it('renders SHIPPED state with shippedAt', () => {
    const shipped = { ...baseShipment, status: 'SHIPPED' as const, shippedAt: '2026-10-24T08:00:00Z' };
    const { queryAllByText } = render(
      <ShipmentTimeline shipment={shipped} index={0} orderItems={mockOrderItems} />,
    );
    expect(queryAllByText('SHIPPED').length).toBeGreaterThan(0);
    expect(queryAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it('renders DELIVERED state with shippedAt and deliveredAt', () => {
    const delivered = {
      ...baseShipment,
      status: 'DELIVERED' as const,
      shippedAt: '2026-10-24T08:00:00Z',
      deliveredAt: '2026-10-25T10:00:00Z',
    };
    const { getByText, queryAllByText } = render(
      <ShipmentTimeline shipment={delivered} index={1} orderItems={mockOrderItems} />,
    );
    expect(getByText('Shipment 2')).toBeTruthy();
    expect(queryAllByText('DELIVERED').length).toBeGreaterThan(0);
    expect(queryAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it('renders FAILED exception state with truthful copy', () => {
    const failed = { ...baseShipment, status: 'FAILED' as const };
    const { getByText } = render(
      <ShipmentTimeline shipment={failed} index={0} orderItems={mockOrderItems} />,
    );
    expect(getByText('Shipment issue')).toBeTruthy();
    expect(getByText('Delivery attempt failed. The package may be returned to the seller.')).toBeTruthy();
  });

  it('renders RETURNED exception state', () => {
    const returned = { ...baseShipment, status: 'RETURNED' as const };
    const { getByText } = render(
      <ShipmentTimeline shipment={returned} index={0} orderItems={mockOrderItems} />,
    );
    expect(getByText('Shipment returned')).toBeTruthy();
    expect(getByText('This shipment has been returned.')).toBeTruthy();
  });

  it('renders CANCELLED exception state', () => {
    const cancelled = { ...baseShipment, status: 'CANCELLED' as const };
    const { getByText } = render(
      <ShipmentTimeline shipment={cancelled} index={0} orderItems={mockOrderItems} />,
    );
    expect(getByText('Shipment cancelled')).toBeTruthy();
    expect(getByText('This shipment has been cancelled.')).toBeTruthy();
  });

  it('handles null carrier', () => {
    const noCarrier = { ...baseShipment, carrier: null };
    const { queryByText } = render(
      <ShipmentTimeline shipment={noCarrier} index={0} orderItems={mockOrderItems} />,
    );
    expect(queryByText('Giao Hang Nhanh')).toBeNull();
  });

  it('handles null tracking code', () => {
    const noTracking = { ...baseShipment, trackingCode: null };
    const { getByText } = render(
      <ShipmentTimeline shipment={noTracking} index={0} orderItems={mockOrderItems} />,
    );
    expect(getByText('Tracking code not available yet')).toBeTruthy();
  });

  it('handles null shippedAt and deliveredAt', () => {
    const { queryByText } = render(
      <ShipmentTimeline
        shipment={{ ...baseShipment, shippedAt: null, deliveredAt: null }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(queryByText(/Shipped$/)).toBeNull();
    expect(queryByText(/Delivered$/)).toBeNull();
  });

  it('renders delivery method and formatted shipping fee', () => {
    const { getByText } = render(
      <ShipmentTimeline
        shipment={{
          ...baseShipment,
          deliveryMethod: 'SELF_DELIVERY',
          carrier: { id: 'c2', name: 'Seller Truck' },
          trackingCode: 'SELF-999',
          shippingFee: '0.00',
        }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(getByText('Seller delivery')).toBeTruthy();
    expect(getByText('Seller Truck')).toBeTruthy();
    expect(getByText('SELF-999')).toBeTruthy();
    expect(getByText('0 ₫')).toBeTruthy();
  });

  it('renders PLATFORM_DELIVERY label and formatted non-zero fee', () => {
    const { getByText } = render(
      <ShipmentTimeline
        shipment={{ ...baseShipment, deliveryMethod: 'PLATFORM_DELIVERY', shippingFee: '15000.00' }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(getByText('Platform delivery')).toBeTruthy();
    expect(getByText('15.000 ₫')).toBeTruthy();
  });

  it('resolves shipment item to product name using real OrderItemResponse (A)', () => {
    const { getByText } = render(
      <ShipmentTimeline
        shipment={{
          ...baseShipment,
          items: [{ orderItemId: 'oi-1', quantity: 2 }],
        }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(getByText('Mechanical Keyboard × 2')).toBeTruthy();
  });

  it('never exposes raw UUID in visible text (B)', () => {
    const { queryByText } = render(
      <ShipmentTimeline
        shipment={{
          ...baseShipment,
          items: [{ orderItemId: 'oi-1', quantity: 2 }],
        }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(queryByText('oi-1')).toBeNull();
    expect(queryByText(/oi-1/)).toBeNull();
  });

  it('safely falls back to neutral "Item × {quantity}" when item cannot be resolved (C)', () => {
    const { getByText, queryByText } = render(
      <ShipmentTimeline
        shipment={{
          ...baseShipment,
          items: [{ orderItemId: 'unknown-id-999', quantity: 3 }],
        }}
        index={0}
        orderItems={mockOrderItems}
      />,
    );
    expect(getByText('Item × 3')).toBeTruthy();
    expect(queryByText('unknown-id-999')).toBeNull();
  });

  it('safely handles missing or empty orderItems array without crashing', () => {
    const { getByText, queryByText } = render(
      <ShipmentTimeline
        shipment={{
          ...baseShipment,
          items: [{ orderItemId: 'oi-1', quantity: 2 }],
        }}
        index={0}
      />,
    );
    expect(getByText('Item × 2')).toBeTruthy();
    expect(queryByText('oi-1')).toBeNull();
  });

  it('maps distinct shipment items correctly without cross-assignment across multiple shipments (D)', () => {
    const shipment1: ShipmentResponse = {
      ...baseShipment,
      id: 'ship-1',
      items: [{ orderItemId: 'oi-1', quantity: 2 }],
    };
    const shipment2: ShipmentResponse = {
      ...baseShipment,
      id: 'ship-2',
      sellerId: 'seller-2',
      items: [{ orderItemId: 'oi-2', quantity: 1 }],
    };

    const { getByText: getByText1, queryByText: queryByText1 } = render(
      <ShipmentTimeline shipment={shipment1} index={0} orderItems={mockOrderItems} />,
    );
    expect(getByText1('Mechanical Keyboard × 2')).toBeTruthy();
    expect(queryByText1('Gaming Mouse × 1')).toBeNull();

    const { getByText: getByText2, queryByText: queryByText2 } = render(
      <ShipmentTimeline shipment={shipment2} index={1} orderItems={mockOrderItems} />,
    );
    expect(getByText2('Gaming Mouse × 1')).toBeTruthy();
    expect(queryByText2('Mechanical Keyboard × 2')).toBeNull();
  });
});
