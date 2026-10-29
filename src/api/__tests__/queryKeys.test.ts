/**
 * Unit tests for the central query-key factory.
 *
 * Only the structural contract is asserted: the resource prefix is always the
 * first element (so prefix invalidation works) and parameters are included so
 * different filter/param combinations map to distinct cache entries.
 */

import { queryKeys, type ProductListFilters, type SellerProductListFilters } from '../queryKeys';
import type {
  SellerOrderItemFilterParams,
  SellerShipmentFilterParams,
} from '../../types/sellerApi';

describe('queryKeys', () => {
  it('keys every list/detail query under its resource prefix', () => {
    expect(queryKeys.user.me()[0]).toBe('user');
    expect(queryKeys.products.detail('p-1')[0]).toBe('products');
    expect(queryKeys.sellerProducts.detail('sp-1')[0]).toBe('sellerProducts');
    expect(queryKeys.cart.current()[0]).toBe('cart');
    expect(queryKeys.orders.detail('o-1')[0]).toBe('orders');
    expect(queryKeys.sellerFulfillment.all[0]).toBe('sellerFulfillment');
  });

  it('uses stable resource-only prefixes for invalidation', () => {
    expect(queryKeys.products.all).toEqual(['products']);
    expect(queryKeys.sellerProducts.all).toEqual(['sellerProducts']);
    expect(queryKeys.categories.all).toEqual(['categories']);
    expect(queryKeys.sellers.all).toEqual(['sellers']);
    expect(queryKeys.reviews.all).toEqual(['reviews']);
    expect(queryKeys.shipments.all).toEqual(['shipments']);
    expect(queryKeys.sellerFulfillment.all).toEqual(['sellerFulfillment']);
    expect(queryKeys.sellerFulfillment.orderItems.all).toEqual(['sellerFulfillment', 'orderItems']);
    expect(queryKeys.sellerFulfillment.shipments.all).toEqual(['sellerFulfillment', 'shipments']);
    expect(queryKeys.sellerFulfillment.carriers.all).toEqual(['sellerFulfillment', 'carriers']);
  });

  it('embeds filters in the product list key so combinations differ', () => {
    const filters: ProductListFilters = { q: 'phone', page: 0 };
    expect(queryKeys.products.list(filters)).toEqual(['products', 'list', filters]);
    expect(queryKeys.products.list({ q: 'phone', page: 1 })).not.toEqual(
      queryKeys.products.list(filters),
    );
  });

  it('embeds filters in seller product list key so combinations differ', () => {
    const defaultList = queryKeys.sellerProducts.list();
    expect(defaultList).toEqual(['sellerProducts', 'list', {}]);

    const filters1: SellerProductListFilters = { q: 'laptop', active: true, page: 0, size: 20 };
    const filters2: SellerProductListFilters = { q: 'laptop', active: false, page: 0, size: 20 };
    const filters3: SellerProductListFilters = { q: 'laptop', active: true, page: 1, size: 20 };
    const filters4: SellerProductListFilters = { q: 'audio', active: true, page: 0, size: 20 };
    const filters5: SellerProductListFilters = { q: 'laptop', active: true, page: 0, size: 10 };

    expect(queryKeys.sellerProducts.list(filters1)).toEqual([
      'sellerProducts',
      'list',
      filters1,
    ]);
    expect(queryKeys.sellerProducts.list(filters1)).not.toEqual(
      queryKeys.sellerProducts.list(filters2),
    );
    expect(queryKeys.sellerProducts.list(filters1)).not.toEqual(
      queryKeys.sellerProducts.list(filters3),
    );
    expect(queryKeys.sellerProducts.list(filters1)).not.toEqual(
      queryKeys.sellerProducts.list(filters4),
    );
    expect(queryKeys.sellerProducts.list(filters1)).not.toEqual(
      queryKeys.sellerProducts.list(filters5),
    );
  });

  it('includes identifiers in detail keys', () => {
    expect(queryKeys.products.detail('p-1')).toEqual(['products', 'detail', 'p-1']);
    expect(queryKeys.sellerProducts.detail('sp-1')).toEqual(['sellerProducts', 'detail', 'sp-1']);
    expect(queryKeys.sellers.shop('s-1')).toEqual(['sellers', 'shop', 's-1']);
    expect(queryKeys.reviews.byProduct('p-1')).toEqual(['reviews', 'product', 'p-1']);
    expect(queryKeys.shipments.byOrder('o-1')).toEqual(['shipments', 'order', 'o-1']);
  });

  it('embeds filters in seller fulfillment keys for independent caching', () => {
    const itemFilters1: SellerOrderItemFilterParams = { status: 'PENDING', page: 0 };
    const itemFilters2: SellerOrderItemFilterParams = { status: 'CONFIRMED', page: 0 };
    expect(queryKeys.sellerFulfillment.orderItems.list(itemFilters1)).toEqual([
      'sellerFulfillment',
      'orderItems',
      'list',
      itemFilters1,
    ]);
    expect(queryKeys.sellerFulfillment.orderItems.list(itemFilters1)).not.toEqual(
      queryKeys.sellerFulfillment.orderItems.list(itemFilters2),
    );

    const shipmentFilters1: SellerShipmentFilterParams = { status: 'PREPARING', page: 0 };
    const shipmentFilters2: SellerShipmentFilterParams = { status: 'SHIPPED', page: 0 };
    expect(queryKeys.sellerFulfillment.shipments.list(shipmentFilters1)).toEqual([
      'sellerFulfillment',
      'shipments',
      'list',
      shipmentFilters1,
    ]);
    expect(queryKeys.sellerFulfillment.shipments.list(shipmentFilters1)).not.toEqual(
      queryKeys.sellerFulfillment.shipments.list(shipmentFilters2),
    );

    expect(queryKeys.sellerFulfillment.carriers.list()).toEqual([
      'sellerFulfillment',
      'carriers',
      'list',
    ]);
  });
});
