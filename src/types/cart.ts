/**
 * UI model for the server-backed cart.
 *
 * The backend DTOs live in `types/cartApi.ts`; this module is what screens and
 * components consume after mapping (decimal strings -> numbers, imageUrl ->
 * React Native image source, availability derived rather than serialized).
 *
 * Invariants:
 * - `id` is the cart-item UUID (PATCH/DELETE/checkout identity), never a
 *   product id;
 * - backend ordering is preserved;
 * - a line may be present while unavailable (`active === false` or
 *   `quantity > availableStock`); it stays visible and removable;
 * - `subtotal` is the backend's authoritative amount and excludes
 *   non-purchasable lines.
 */

import type { ImageSourcePropType } from 'react-native';

/** One mapped cart line. */
export type CartLine = {
  /** Cart-item UUID; mutation identity. */
  id: string;
  /** Product UUID. */
  productId: string;
  /** Display name. */
  name: string;
  /** Bundled placeholder when the backend image URL is null/blank. */
  image: ImageSourcePropType;
  /** Current product price in VND (parsed from the decimal string). */
  unitPrice: number;
  /** Backend-computed line total in VND (parsed from the decimal string). */
  lineTotal: number;
  /** Units in the cart; always >= 1. */
  quantity: number;
  /** Current product stock. */
  availableStock: number;
  /** Product is still on sale. */
  active: boolean;
  /** Owning seller UUID. */
  sellerId: string;
  /** ISO-8601 creation timestamp of the cart line. */
  createdAt: string;
  /** `active && quantity <= availableStock`. Not serialized by the backend. */
  available: boolean;
};

/** The mapped cart, including the derived values screens need. */
export type Cart = {
  /** Backend order, unchanged. */
  items: CartLine[];
  /** Backend-authoritative subtotal in VND (purchasable lines only). */
  subtotal: number;
  /** Sum of `items[].quantity`; drives the Cart tab badge. */
  totalItems: number;
};
