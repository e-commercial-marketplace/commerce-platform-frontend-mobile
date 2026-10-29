/**
 * Unit tests for UpdateProductStockModal.
 *
 * Verifies:
 * - current stock and product name displayed
 * - valid integer accepted
 * - zero accepted (boundary check)
 * - negative integer rejected with error message
 * - decimal value rejected with error message
 * - blank value rejected with error message
 * - callback receives absolute stock value (not delta)
 * - pending/loading state prevents duplicate submission
 * - cancel callback is triggered
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import UpdateProductStockModal from '../UpdateProductStockModal';
import type { ProductSummaryDto } from '../../../types/sellerProductApi';

const mockProduct: ProductSummaryDto = {
  id: 'prod-uuid-1',
  name: 'iPhone 16 Pro Max',
  description: 'A18 Pro',
  imageUrl: 'https://example.com/iphone.png',
  price: '30490000',
  stock: 10,
  ratingAverage: '0',
  reviewCount: 0,
  active: true,
  category: { id: 'cat-1', name: 'Điện thoại' },
  sellerId: 'seller-1',
};

describe('UpdateProductStockModal', () => {
  const mockOnCancel = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays product name and current stock quantity', () => {
    const { getByText } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    expect(getByText('iPhone 16 Pro Max')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
  });

  it('accepts valid integer input and calls onSave with absolute stock value', () => {
    const { getByTestId, getByRole } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const input = getByTestId('update-stock-input');
    // Change current stock from 10 to 15
    fireEvent.changeText(input, '15');

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    // Verifies it sends absolute stock 15, NOT delta
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(15);
  });

  it('accepts zero (0) as a valid stock level', () => {
    const { getByTestId, getByRole, queryByTestId } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const input = getByTestId('update-stock-input');
    fireEvent.changeText(input, '0');

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(0);
    expect(queryByTestId('update-stock-error')).toBeNull();
  });

  it('rejects negative stock input with validation error and does not call onSave', () => {
    const { getByTestId, getByRole, getByText } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const input = getByTestId('update-stock-input');
    fireEvent.changeText(input, '-5');

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(getByText('Stock must be 0 or greater.')).toBeTruthy();
  });

  it('rejects decimal numbers with validation error', () => {
    const { getByTestId, getByRole, getByText } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const input = getByTestId('update-stock-input');
    fireEvent.changeText(input, '12.5');

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(getByText('Stock must be a whole number.')).toBeTruthy();
  });

  it('rejects empty or whitespace input with validation error', () => {
    const { getByTestId, getByRole, getByText } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const input = getByTestId('update-stock-input');
    fireEvent.changeText(input, '   ');

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(getByText('Stock is required.')).toBeTruthy();
  });

  it('prevents submission and disables buttons while pending/loading', () => {
    const { getByRole } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        pending={true}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const saveBtn = getByRole('button', { name: 'Save stock update' });
    fireEvent.press(saveBtn);

    expect(mockOnSave).not.toHaveBeenCalled();

    const cancelBtn = getByRole('button', { name: 'Cancel stock update' });
    fireEvent.press(cancelBtn);

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('triggers onCancel when Cancel button is pressed', () => {
    const { getByRole } = render(
      <UpdateProductStockModal
        visible={true}
        product={mockProduct}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />,
    );

    const cancelBtn = getByRole('button', { name: 'Cancel stock update' });
    fireEvent.press(cancelBtn);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });
});
