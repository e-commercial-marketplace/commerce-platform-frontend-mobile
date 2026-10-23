/**
 * Cart API service - thin wrappers over the real backend endpoints.
 *
 * Uses the shared `apiClient` (base URL, Bearer header, 401 refresh behavior)
 * and the shared `unwrapData` helper, so the cart inherits the same auth and
 * error handling as every other feature.
 *
 * Contract verified against the backend source:
 * - GET    /cart                -> ApiResponse<CartResponse>
 * - POST   /cart/items          -> ApiResponse<CartResponse>
 * - PATCH  /cart/items/{id}     -> ApiResponse<CartResponse>
 * - DELETE /cart/items/{id}     -> ApiResponse<CartResponse>
 *
 * Every cart mutation answers with the full, authoritative cart, which is what
 * the TanStack Query layer stores in the cache. There is no clear-cart
 * endpoint on the backend; `clearCart` is a client-side composite built from
 * the DELETE endpoint (see `hooks/useCart.ts`).
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  AddCartItemRequest,
  CartDto,
  UpdateCartItemRequest,
} from '../types/cartApi';

/** GET /cart - the signed-in customer's cart. */
export async function getCart(): Promise<CartDto> {
  const response = await apiClient.get<ApiResponse<CartDto>>('/cart');
  return unwrapData(response);
}

/** POST /cart/items - adds `quantity` (a delta) of a product to the cart. */
export async function addCartItem(input: AddCartItemRequest): Promise<CartDto> {
  const response = await apiClient.post<ApiResponse<CartDto>>('/cart/items', input);
  return unwrapData(response);
}

/** PATCH /cart/items/{id} - sets the line quantity absolutely. */
export async function updateCartItem(
  id: string,
  input: UpdateCartItemRequest,
): Promise<CartDto> {
  const response = await apiClient.patch<ApiResponse<CartDto>>(`/cart/items/${id}`, input);
  return unwrapData(response);
}

/** DELETE /cart/items/{id} - removes the line identified by its cart-item id. */
export async function deleteCartItem(id: string): Promise<CartDto> {
  const response = await apiClient.delete<ApiResponse<CartDto>>(`/cart/items/${id}`);
  return unwrapData(response);
}
