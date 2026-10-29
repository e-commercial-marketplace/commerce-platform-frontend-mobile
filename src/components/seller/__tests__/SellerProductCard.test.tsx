/**
 * Unit tests for SellerProductCard.
 *
 * Verifies:
 * - renders actual product information (name, category, price, stock)
 * - displays active status badge ("Listed")
 * - displays inactive status badge ("Unlisted")
 * - triggers Edit callback on press
 * - triggers Stock callback on press
 * - triggers Unlist callback for active product
 * - triggers Relist callback for inactive product
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SellerProductCard from '../SellerProductCard';
import type { ProductSummaryDto } from '../../../types/sellerProductApi';

const mockActiveProduct: ProductSummaryDto = {
  id: 'prod-uuid-1',
  name: 'MacBook Pro 14 inch',
  description: 'M3 Pro chip, 18GB RAM',
  imageUrl: 'https://example.com/macbook.png',
  price: '39990000',
  stock: 12,
  ratingAverage: '4.80',
  reviewCount: 25,
  active: true,
  category: {
    id: 'cat-uuid-1',
    name: 'Laptop',
  },
  sellerId: 'seller-uuid-1',
};

const mockInactiveProduct: ProductSummaryDto = {
  ...mockActiveProduct,
  id: 'prod-uuid-2',
  name: 'Dell XPS 13',
  stock: 0,
  active: false,
};

describe('SellerProductCard', () => {
  const mockOnEdit = jest.fn();
  const mockOnUpdateStock = jest.fn();
  const mockOnUnlist = jest.fn();
  const mockOnRelist = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders actual product information and active status correctly', () => {
    const { getByText } = render(
      <SellerProductCard
        product={mockActiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    expect(getByText('MacBook Pro 14 inch')).toBeTruthy();
    expect(getByText('Laptop')).toBeTruthy();
    expect(getByText('39.990.000 ₫')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
    expect(getByText('Listed')).toBeTruthy();
  });

  it('renders inactive status and Relist button for inactive product', () => {
    const { getByText, queryByText } = render(
      <SellerProductCard
        product={mockInactiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    expect(getByText('Dell XPS 13')).toBeTruthy();
    expect(getByText('Unlisted')).toBeTruthy();
    expect(getByText('Relist')).toBeTruthy();
    expect(queryByText('Unlist')).toBeNull();
  });

  it('invokes onEdit callback when Edit button is pressed', () => {
    const { getByRole } = render(
      <SellerProductCard
        product={mockActiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    const editBtn = getByRole('button', { name: 'Edit MacBook Pro 14 inch' });
    fireEvent.press(editBtn);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).toHaveBeenCalledWith(mockActiveProduct);
  });

  it('invokes onUpdateStock callback when Update Stock button is pressed', () => {
    const { getByRole } = render(
      <SellerProductCard
        product={mockActiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    const stockBtn = getByRole('button', {
      name: 'Update stock for MacBook Pro 14 inch',
    });
    fireEvent.press(stockBtn);

    expect(mockOnUpdateStock).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateStock).toHaveBeenCalledWith(mockActiveProduct);
  });

  it('invokes onUnlist callback for active product when Unlist is pressed', () => {
    const { getByRole } = render(
      <SellerProductCard
        product={mockActiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    const unlistBtn = getByRole('button', {
      name: 'Unlist MacBook Pro 14 inch',
    });
    fireEvent.press(unlistBtn);

    expect(mockOnUnlist).toHaveBeenCalledTimes(1);
    expect(mockOnUnlist).toHaveBeenCalledWith(mockActiveProduct);
    expect(mockOnRelist).not.toHaveBeenCalled();
  });

  it('invokes onRelist callback for inactive product when Relist is pressed', () => {
    const { getByRole } = render(
      <SellerProductCard
        product={mockInactiveProduct}
        onEdit={mockOnEdit}
        onUpdateStock={mockOnUpdateStock}
        onUnlist={mockOnUnlist}
        onRelist={mockOnRelist}
      />,
    );

    const relistBtn = getByRole('button', {
      name: 'Relist Dell XPS 13',
    });
    fireEvent.press(relistBtn);

    expect(mockOnRelist).toHaveBeenCalledTimes(1);
    expect(mockOnRelist).toHaveBeenCalledWith(mockInactiveProduct);
    expect(mockOnUnlist).not.toHaveBeenCalled();
  });
});
