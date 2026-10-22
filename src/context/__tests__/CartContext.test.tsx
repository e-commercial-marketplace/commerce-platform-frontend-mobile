/**
 * Behavior tests for the local runtime cart.
 *
 * The provider is exercised through the public `useCart` hook so tests stay
 * on the public contract (state + actions) rather than internal setState calls.
 */

import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';

import { CartProvider } from '../CartContext';
import { useCart } from '../../hooks/useCart';
import type { Product } from '../../types/product';

const wrapper = ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>;

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Phone',
  price: 1000000,
  image: { uri: 'https://cdn.example.com/p.jpg' },
  rating: 4.5,
  reviewCount: 10,
  category: 'Phones',
  description: 'A phone',
  ...overrides,
});

describe('CartContext', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it('adds a product with the default quantity of 1', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct());
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.totalItems).toBe(1);
    expect(result.current.subtotal).toBe(1000000);
  });

  it('adds a product with an explicit quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct(), 3);
    });

    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.totalItems).toBe(3);
    expect(result.current.subtotal).toBe(3000000);
  });

  it('merges a repeated product instead of creating a new line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = makeProduct();

    act(() => {
      result.current.addItem(product, 1);
    });
    act(() => {
      result.current.addItem(product, 2);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.totalItems).toBe(3);
  });

  it('keeps distinct products on separate lines', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct({ id: 'p-1', price: 1000 }));
    });
    act(() => {
      result.current.addItem(makeProduct({ id: 'p-2', price: 2000 }));
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.subtotal).toBe(3000);
  });

  it('floors fractional quantities and never adds below 1', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct({ id: 'p-1' }), 2.9);
    });
    act(() => {
      result.current.addItem(makeProduct({ id: 'p-2' }), 0);
    });

    expect(result.current.items.find((item) => item.product.id === 'p-1')?.quantity).toBe(2);
    expect(result.current.items.find((item) => item.product.id === 'p-2')?.quantity).toBe(1);
  });

  it('increases the quantity of a known line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct());
    });
    act(() => {
      result.current.increaseQuantity('p-1');
    });

    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
  });

  it('decreases the quantity down to a floor of 1', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct(), 2);
    });
    act(() => {
      result.current.decreaseQuantity('p-1');
    });
    act(() => {
      result.current.decreaseQuantity('p-1');
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('ignores increase/decrease for unknown product ids', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct());
    });
    act(() => {
      result.current.increaseQuantity('missing');
      result.current.decreaseQuantity('missing');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
  });

  it('removes a line regardless of its quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct(), 5);
    });
    act(() => {
      result.current.removeItem('p-1');
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
  });

  it('clears the whole cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(makeProduct({ id: 'p-1' }), 2);
      result.current.addItem(makeProduct({ id: 'p-2' }), 1);
    });
    act(() => {
      result.current.clearCart();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it('throws when useCart is used outside a CartProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCart())).toThrow('useCart must be used within a CartProvider');
    spy.mockRestore();
  });
});
