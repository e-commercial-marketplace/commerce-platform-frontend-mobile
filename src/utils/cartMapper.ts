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

/** Cùng quy tắc với CartResponse.of ở backend: subtotal chỉ cộng các dòng mua được. */
function withRecalculatedSubtotal(items: CartItemDto[]): CartDto {
  const subtotal = items
    .filter((item) => item.active && item.quantity <= item.availableStock)
    .reduce((sum, item) => sum + parseDecimalString(item.lineTotal), 0);
  return { items, subtotal: subtotal.toFixed(2) };
}

/** Bản giỏ dự đoán sau khi đổi số lượng; response của server sẽ thay thế bản này. */
export function predictQuantityChange(cart: CartDto, id: string, quantity: number): CartDto {
  return withRecalculatedSubtotal(
    cart.items.map((item) =>
      item.id === id
        ? { ...item, quantity, lineTotal: (parseDecimalString(item.unitPrice) * quantity).toFixed(2) }
        : item,
    ),
  );
}

/** Bản giỏ dự đoán sau khi xoá một dòng; response của server sẽ thay thế bản này. */
export function predictLineRemoval(cart: CartDto, id: string): CartDto {
  return withRecalculatedSubtotal(cart.items.filter((item) => item.id !== id));
}
