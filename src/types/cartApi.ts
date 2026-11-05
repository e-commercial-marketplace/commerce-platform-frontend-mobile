/**
 * Backend DTO types for the cart API.
 *
 * These mirror the backend records exactly (CartResponse / CartItemResponse)
 * and are intentionally kept separate from the UI-friendly cart model in
 * `types/cart.ts`. Field names must not drift from the wire format.
 *
 * Contract verified against the backend source:
 * - GET    /api/v1/cart                -> ApiResponse<CartResponse>
 * - POST   /api/v1/cart/items          -> ApiResponse<CartResponse>
 * - PATCH  /api/v1/cart/items/{id}     -> ApiResponse<CartResponse>
 * - DELETE /api/v1/cart/items/{id}     -> ApiResponse<CartResponse>
 *
 * Money values are decimal STRINGS (`@JsonFormat(shape = STRING)`), never JSON
 * numbers.
 */

/** One line of CartResponse; prices are read from the product at request time. */
export type CartItemDto = {
  /** Cart-item UUID. Mutation identity (PATCH/DELETE/checkout), not productId. */
  id: string;
  /** Product UUID this line refers to. */
  productId: string;
  /** Product name snapshot for display. */
  name: string;
  /** Product image URL; the backend omits/reports null when absent. */
  imageUrl: string | null;
  /** Current product price as a decimal string, e.g. "59.00". */
  unitPrice: string;
  /** Units currently in the cart. Always >= 1. */
  quantity: number;
  /** unitPrice * quantity (backend-computed decimal string). */
  lineTotal: string;
  /** Current product stock. */
  availableStock: number;
  /** Product is still on sale. */
  active: boolean;
  /** Owning seller UUID. */
  sellerId: string;
  /** ISO-8601 creation timestamp of the cart line. */
  createdAt: string;
};

/** Body of CartResponse. Subtotal counts purchasable lines only. */
export type CartDto = {
  items: CartItemDto[];
  /** Authoritative subtotal as a decimal string. */
  subtotal: string;
};

/** Body of POST /api/v1/cart/items; quantity is a DELTA (amount to add). */
export type AddCartItemRequest = {
  productId: string;
  quantity: number;
};

/** Body of PATCH /api/v1/cart/items/{id}; quantity is ABSOLUTE. */
export type UpdateCartItemRequest = {
  quantity: number;
};
