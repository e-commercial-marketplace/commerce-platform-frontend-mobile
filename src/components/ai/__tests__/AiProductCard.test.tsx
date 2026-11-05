/**
 * Unit tests for AiProductCard.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import AiProductCard, { getStockStatus } from '../AiProductCard';
import type { AiProductResponse } from '../../../types/aiApi';

const baseProduct: AiProductResponse = {
  id: 'prod-101',
  name: 'Tai nghe Bluetooth Sony WH-1000XM5',
  imageUrl: 'https://example.com/sony.jpg',
  price: '6490000.00',
  stock: 12,
  ratingAverage: '4.80',
  reviewCount: 38,
  sellerId: 'seller-99',
};

describe('AiProductCard', () => {
  it('renders product name, formatted price, rating, review count, and stock status', () => {
    const handlePress = jest.fn();
    const { getByText } = render(
      <AiProductCard product={baseProduct} onPress={handlePress} />,
    );

    expect(getByText('Tai nghe Bluetooth Sony WH-1000XM5')).toBeTruthy();
    expect(getByText('6.490.000 ₫')).toBeTruthy();
    expect(getByText('4.8')).toBeTruthy();
    expect(getByText('(38 reviews)')).toBeTruthy();
    expect(getByText('In stock')).toBeTruthy();
  });

  describe('Stock status badges', () => {
    it('renders "Out of stock" when stock is 0', () => {
      const productOutOfStock: AiProductResponse = {
        ...baseProduct,
        stock: 0,
      };
      const { getByText } = render(
        <AiProductCard product={productOutOfStock} onPress={jest.fn()} />,
      );

      expect(getByText('Out of stock')).toBeTruthy();
    });

    it('renders "X left" when stock is between 1 and 5', () => {
      const productLowStock: AiProductResponse = {
        ...baseProduct,
        stock: 3,
      };
      const { getByText } = render(
        <AiProductCard product={productLowStock} onPress={jest.fn()} />,
      );

      expect(getByText('3 left')).toBeTruthy();
    });

    it('renders "In stock" when stock is greater than 5', () => {
      const productInStock: AiProductResponse = {
        ...baseProduct,
        stock: 8,
      };
      const { getByText } = render(
        <AiProductCard product={productInStock} onPress={jest.fn()} />,
      );

      expect(getByText('In stock')).toBeTruthy();
    });

    it('getStockStatus helper returns correct styles and labels', () => {
      expect(getStockStatus(0)).toEqual({
        label: 'Out of stock',
        bg: '#FEE2E2',
        text: '#DC2626',
      });
      expect(getStockStatus(4)).toEqual({
        label: '4 left',
        bg: '#FEF3C7',
        text: '#D97706',
      });
      expect(getStockStatus(15)).toEqual({
        label: 'In stock',
        bg: '#ECFDF5',
        text: '#059669',
      });
    });
  });

  describe('Image fallback handling', () => {
    it('renders safely when imageUrl is null', () => {
      const productNoImage: AiProductResponse = {
        ...baseProduct,
        imageUrl: null,
      };
      const { getByText } = render(
        <AiProductCard product={productNoImage} onPress={jest.fn()} />,
      );

      expect(getByText('Tai nghe Bluetooth Sony WH-1000XM5')).toBeTruthy();
    });

    it('renders safely when imageUrl is an empty string', () => {
      const productEmptyImage: AiProductResponse = {
        ...baseProduct,
        imageUrl: '   ',
      };
      const { getByText } = render(
        <AiProductCard product={productEmptyImage} onPress={jest.fn()} />,
      );

      expect(getByText('Tai nghe Bluetooth Sony WH-1000XM5')).toBeTruthy();
    });
  });

  describe('User interaction', () => {
    it('fires onPress with full product object when tapped', () => {
      const handlePress = jest.fn();
      const { getByRole } = render(
        <AiProductCard product={baseProduct} onPress={handlePress} />,
      );

      fireEvent.press(getByRole('button'));
      expect(handlePress).toHaveBeenCalledTimes(1);
      expect(handlePress).toHaveBeenCalledWith(baseProduct);
    });

    it('allows tapping even when stock is 0 (out of stock navigation is not blocked)', () => {
      const handlePress = jest.fn();
      const productOutOfStock: AiProductResponse = {
        ...baseProduct,
        stock: 0,
      };
      const { getByRole } = render(
        <AiProductCard product={productOutOfStock} onPress={handlePress} />,
      );

      fireEvent.press(getByRole('button'));
      expect(handlePress).toHaveBeenCalledWith(productOutOfStock);
    });
  });

  describe('Defensive parsing against malformed wire values', () => {
    it('does not crash when price is a non-numeric or malformed string', () => {
      const productBadPrice: AiProductResponse = {
        ...baseProduct,
        price: 'invalid_price',
      };
      const { getByText } = render(
        <AiProductCard product={productBadPrice} onPress={jest.fn()} />,
      );

      expect(getByText('0 ₫')).toBeTruthy();
    });

    it('does not crash when ratingAverage is non-numeric', () => {
      const productBadRating: AiProductResponse = {
        ...baseProduct,
        ratingAverage: 'not_a_number',
      };
      const { getByText } = render(
        <AiProductCard product={productBadRating} onPress={jest.fn()} />,
      );

      expect(getByText('0.0')).toBeTruthy();
    });
  });
});
