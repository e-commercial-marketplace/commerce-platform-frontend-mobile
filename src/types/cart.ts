/**
 * Domain model for a cart line.
 *
 * Mirrors the shape a typical cart API exposes ({ product, quantity } when
 * reading, { productId, quantity } when writing), so the local runtime state
 * introduced in this milestone can later be backed by backend cart endpoints
 * without rewriting the UI.
 */

import type { Product } from './product';

export type CartItem = {
  /** Product this line refers to; reused from the catalog type as-is. */
  product: Product;
  /** Units of the product in the cart. Invariant: always >= 1 (enforced by CartContext). */
  quantity: number;
};
