/**
 * Unit tests for the central query-key factory.
 *
 * Only the structural contract is asserted: the resource prefix is always the
 * first element (so prefix invalidation works) and parameters are included so
 * different filter/param combinations map to distinct cache entries.
 */

import { queryKeys, type ProductListFilters } from '../queryKeys';

describe('queryKeys', () => {
  it('keys every list/detail query under its resource prefix', () => {
    expect(queryKeys.user.me()[0]).toBe('user');
    expect(queryKeys.products.detail('p-1')[0]).toBe('products');
    expect(queryKeys.cart.current()[0]).toBe('cart');
    expect(queryKeys.orders.detail('o-1')[0]).toBe('orders');
  });

  it('uses stable resource-only prefixes for invalidation', () => {
    expect(queryKeys.products.all).toEqual(['products']);
    expect(queryKeys.categories.all).toEqual(['categories']);
    expect(queryKeys.sellers.all).toEqual(['sellers']);
    expect(queryKeys.reviews.all).toEqual(['reviews']);
    expect(queryKeys.shipments.all).toEqual(['shipments']);
  });

  it('embeds filters in the product list key so combinations differ', () => {
    const filters: ProductListFilters = { q: 'phone', page: 0 };
    expect(queryKeys.products.list(filters)).toEqual(['products', 'list', filters]);
    expect(queryKeys.products.list({ q: 'phone', page: 1 })).not.toEqual(
      queryKeys.products.list(filters),
    );
  });

  it('includes identifiers in detail keys', () => {
    expect(queryKeys.products.detail('p-1')).toEqual(['products', 'detail', 'p-1']);
    expect(queryKeys.sellers.shop('s-1')).toEqual(['sellers', 'shop', 's-1']);
    expect(queryKeys.reviews.byProduct('p-1')).toEqual(['reviews', 'product', 'p-1']);
    expect(queryKeys.shipments.byOrder('o-1')).toEqual(['shipments', 'order', 'o-1']);
  });
});
