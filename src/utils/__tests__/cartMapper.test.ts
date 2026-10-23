/**
 * Unit tests for the backend cart DTO -> UI cart model mapper.
 */

import { mapCartDtoToCart, mapCartItemToLine } from '../cartMapper';
import type { CartDto, CartItemDto } from '../../types/cartApi';

const itemDto: CartItemDto = {
  id: 'cart-item-1',
  productId: 'p-1',
  name: 'iPhone 15 Pro',
  imageUrl: null,
  unitPrice: '29990000.00',
  quantity: 2,
  lineTotal: '59980000.00',
  availableStock: 8,
  active: true,
  sellerId: 's-1',
  createdAt: '2026-10-01T10:00:00Z',
};

describe('mapCartItemToLine', () => {
  it('parses decimal unitPrice and lineTotal strings into numbers', () => {
    const line = mapCartItemToLine({ ...itemDto, unitPrice: '59.50', lineTotal: '119.00' });

    expect(line.unitPrice).toBe(59.5);
    expect(line.lineTotal).toBe(119);
  });

  it('preserves the cart-item id and the product id separately', () => {
    const line = mapCartItemToLine(itemDto);

    expect(line.id).toBe('cart-item-1');
    expect(line.productId).toBe('p-1');
  });

  it('preserves quantity, stock, active, sellerId and createdAt', () => {
    const line = mapCartItemToLine(itemDto);

    expect(line.quantity).toBe(2);
    expect(line.availableStock).toBe(8);
    expect(line.active).toBe(true);
    expect(line.sellerId).toBe('s-1');
    expect(line.createdAt).toBe('2026-10-01T10:00:00Z');
  });

  it('uses a remote uri when imageUrl is present', () => {
    const line = mapCartItemToLine({ ...itemDto, imageUrl: 'https://cdn.example.com/p.jpg' });

    expect(line.image).toEqual({ uri: 'https://cdn.example.com/p.jpg' });
  });

  it('falls back to the bundled placeholder when imageUrl is null', () => {
    const line = mapCartItemToLine({ ...itemDto, imageUrl: null });

    expect(line.image).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
    expect(line.image).toBeDefined();
  });

  it('falls back to the bundled placeholder when imageUrl is blank', () => {
    const line = mapCartItemToLine({ ...itemDto, imageUrl: '   ' });

    expect(line.image).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
    expect(line.image).toBeDefined();
  });

  it('is available when the product is active and quantity fits the stock', () => {
    const line = mapCartItemToLine({ ...itemDto, active: true, quantity: 3, availableStock: 3 });

    expect(line.available).toBe(true);
  });

  it('is unavailable when the product is inactive', () => {
    const line = mapCartItemToLine({ ...itemDto, active: false });

    expect(line.available).toBe(false);
  });

  it('is unavailable when quantity exceeds availableStock', () => {
    const line = mapCartItemToLine({ ...itemDto, quantity: 4, availableStock: 3 });

    expect(line.available).toBe(false);
  });

  it('returns 0 for malformed money strings instead of NaN', () => {
    const line = mapCartItemToLine({ ...itemDto, unitPrice: 'n/a', lineTotal: 'n/a' });

    expect(line.unitPrice).toBe(0);
    expect(line.lineTotal).toBe(0);
  });
});

describe('mapCartDtoToCart', () => {
  it('preserves the backend item order', () => {
    const dto: CartDto = {
      items: [
        { ...itemDto, id: 'cart-item-1', productId: 'p-1' },
        { ...itemDto, id: 'cart-item-2', productId: 'p-2' },
        { ...itemDto, id: 'cart-item-3', productId: 'p-3' },
      ],
      subtotal: '0.00',
    };

    const cart = mapCartDtoToCart(dto);

    expect(cart.items.map((line) => line.id)).toEqual([
      'cart-item-1',
      'cart-item-2',
      'cart-item-3',
    ]);
  });

  it('derives totalItems as the sum of line quantities', () => {
    const dto: CartDto = {
      items: [
        { ...itemDto, id: 'a', quantity: 2 },
        { ...itemDto, id: 'b', quantity: 3 },
      ],
      subtotal: '0.00',
    };

    expect(mapCartDtoToCart(dto).totalItems).toBe(5);
  });

  it('uses the backend subtotal verbatim instead of recomputing it', () => {
    const dto: CartDto = {
      items: [{ ...itemDto, quantity: 2, lineTotal: '59980000.00', active: false }],
      // Deliberately different from lineTotal: the backend excludes
      // non-purchasable lines and remains authoritative.
      subtotal: '123.45',
    };

    expect(mapCartDtoToCart(dto).subtotal).toBe(123.45);
  });

  it('maps an empty cart to empty items and zero totals', () => {
    const cart = mapCartDtoToCart({ items: [], subtotal: '0.00' });

    expect(cart.items).toEqual([]);
    expect(cart.totalItems).toBe(0);
    expect(cart.subtotal).toBe(0);
  });
});
