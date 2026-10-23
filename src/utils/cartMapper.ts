/**
 * Maps backend cart DTOs to the UI cart model.
 *
 * Background: the backend serializes every money value as a decimal string
 * (`@JsonFormat(shape = STRING)`), so `unitPrice`, `lineTotal` and `subtotal`
 * are parsed defensively here instead of being treated as numbers downstream.
 * `imageUrl` is nullable and may be blank; both cases fall back to the same
 * bundled placeholder the catalog uses.
 *
 * Availability is not serialized by the backend (the DTO carries `active` and
 * `availableStock` only), so it is derived as
 * `active && quantity <= availableStock`. Backend ordering is preserved.
 */

import type { Cart, CartLine } from '../types/cart';
import type { CartDto, CartItemDto } from '../types/cartApi';

const PLACEHOLDER_IMAGE = require('../assets/products/iphone-15-pro.jpg');

/** Parses a backend decimal string, returning 0 for malformed input. */
function parseDecimalString(value: string): number {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** One cart line, with money parsed and the image source resolved. */
export function mapCartItemToLine(dto: CartItemDto): CartLine {
  const image =
    dto.imageUrl != null && dto.imageUrl.trim().length > 0
      ? { uri: dto.imageUrl }
      : PLACEHOLDER_IMAGE;

  return {
    id: dto.id,
    productId: dto.productId,
    name: dto.name,
    image,
    unitPrice: parseDecimalString(dto.unitPrice),
    lineTotal: parseDecimalString(dto.lineTotal),
    quantity: dto.quantity,
    availableStock: dto.availableStock,
    active: dto.active,
    sellerId: dto.sellerId,
    createdAt: dto.createdAt,
    available: dto.active && dto.quantity <= dto.availableStock,
  };
}

/** Full cart: preserves backend order and uses the backend subtotal as-is. */
export function mapCartDtoToCart(dto: CartDto): Cart {
  const items = dto.items.map(mapCartItemToLine);

  return {
    items,
    subtotal: parseDecimalString(dto.subtotal),
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
