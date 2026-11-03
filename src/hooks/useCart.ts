/**
 * Server-backed cart facade built on TanStack Query.
 *
 * This replaces the old local CartContext as the single source of truth:
 * the cache entry `queryKeys.cart.current()` holds the raw `CartDto` returned
 * by the backend, and every mutation replaces it with the authoritative cart
 * from the response. Đổi số lượng và xoá dòng cập nhật lạc quan: giao diện đổi ngay,
 * response thay bản dự đoán, lỗi thì khôi phục. Thêm vào giỏ và xoá toàn giỏ thì không.
 *
 * The query is enabled only for an authenticated CUSTOMER, matching the
 * backend rule that `/api/v1/cart/**` is customer-only. Guests, sellers and
 * admins therefore never trigger a cart request and always observe an empty
 * cart (badge resolves to 0).
 *
 * `clearCart` is a client-side composite: the backend has no clear-cart
 * endpoint, so the current cart-item ids are deleted sequentially through
 * DELETE /cart/items/{id}. The operation is non-atomic; on failure the cart is
 * refetched rather than pretending it is empty.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { queryKeys } from '../api/queryKeys';
import * as cartService from '../services/cartService';
import type { Cart, CartLine } from '../types/cart';
import type { CartDto } from '../types/cartApi';
import { mapCartDtoToCart, predictLineRemoval, predictQuantityChange } from '../utils/cartMapper';
import { useAuth } from './useAuth';

/** Stable empty value so consumers can read `items` before/without data. */
const EMPTY_CART: Cart = { items: [], subtotal: 0, totalItems: 0 };

/** Dữ liệu để hoàn tác một cập nhật lạc quan. */
type CartRollback = { previous: CartDto; predicted: CartDto | undefined };

type UpdateQuantityInput = {
  id: string;
  quantity: number;
};

/**
 * Cart data + actions for the signed-in customer.
 *
 * Read-side: `items`, `totalItems`, `subtotal` (backend value), loading and
 * error state. Write-side actions are async and throw the normalized
 * `ApiError` so screens can display `error.message`.
 */
export function useCart() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';

  const cartQuery = useQuery({
    queryKey: queryKeys.cart.current(),
    queryFn: cartService.getCart,
    enabled: isCustomer,
    // Cart contents change from other devices/checkout, so always revalidate
    // when the screen regains focus instead of trusting a stale snapshot.
    staleTime: 0,
    select: mapCartDtoToCart,
  });

  /** Every mutation answers with the full authoritative cart. */
  const storeCart = (cart: CartDto) => {
    queryClient.setQueryData(queryKeys.cart.current(), cart);
  };

  /** Dừng lần tải đang chạy để nó không ghi đè bản dự đoán, rồi ghi bản dự đoán vào cache. */
  const applyPrediction = async (
    predict: (cart: CartDto) => CartDto,
  ): Promise<CartRollback | undefined> => {
    await queryClient.cancelQueries({ queryKey: queryKeys.cart.current() });
    const previous = queryClient.getQueryData<CartDto>(queryKeys.cart.current());
    if (previous == null) {
      return undefined;
    }
    return {
      previous,
      predicted: queryClient.setQueryData<CartDto>(queryKeys.cart.current(), predict(previous)),
    };
  };

  const rollback = (_error: unknown, _input: unknown, context: CartRollback | undefined) => {
    // Chỉ khôi phục khi cache vẫn là bản dự đoán: vừa đăng xuất thì cache đã bị xoá,
    // không được đưa giỏ của người cũ trở lại.
    if (context != null && queryClient.getQueryData(queryKeys.cart.current()) === context.predicted) {
      queryClient.setQueryData(queryKeys.cart.current(), context.previous);
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.current() });
  };

  const addMutation = useMutation({
    mutationFn: cartService.addCartItem,
    onSuccess: storeCart,
  });

  const updateMutation = useMutation<CartDto, unknown, UpdateQuantityInput, CartRollback | undefined>({
    mutationFn: ({ id, quantity }: UpdateQuantityInput) =>
      cartService.updateCartItem(id, { quantity }),
    onMutate: ({ id, quantity }) =>
      applyPrediction((cart) => predictQuantityChange(cart, id, quantity)),
    onError: rollback,
    onSuccess: storeCart,
  });

  const deleteMutation = useMutation<CartDto, unknown, string, CartRollback | undefined>({
    mutationFn: (id: string) => cartService.deleteCartItem(id),
    onMutate: (id) => applyPrediction((cart) => predictLineRemoval(cart, id)),
    onError: rollback,
    onSuccess: storeCart,
  });

  const clearMutation = useMutation({
    mutationFn: async (): Promise<CartDto> => {
      const cached =
        queryClient.getQueryData<CartDto>(queryKeys.cart.current()) ??
        (await cartService.getCart());

      // Sequential on purpose: predictable order and the last response is the
      // authoritative cart. No cache writes until the whole composite ends.
      let latest = cached;
      for (const item of cached.items) {
        latest = await cartService.deleteCartItem(item.id);
      }
      return latest;
    },
    onSuccess: storeCart,
    onError: () => {
      // Partial deletion is possible; never leave a stale "empty" impression.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.current() });
    },
  });

  const isMutating =
    addMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    clearMutation.isPending;

  // Synchronous duplicate-submission guard: React state (isMutating) only
  // updates on the next render, so two taps in the same tick would otherwise
  // both pass the check.
  const inFlightRef = useRef(false);

  const runOnce = async <T,>(action: () => Promise<T>): Promise<T | null> => {
    if (inFlightRef.current) {
      return null;
    }
    inFlightRef.current = true;
    try {
      return await action();
    } finally {
      inFlightRef.current = false;
    }
  };

  // Non-customers never read another account's cached rows, even while the
  // cache is being purged on logout.
  const cart = isCustomer ? (cartQuery.data ?? EMPTY_CART) : EMPTY_CART;

  /**
   * Adds a delta and returns the authoritative mapped cart from the response.
   * Buy Now uses the returned cart to resolve the resulting cart-item id.
   */
  async function addItem(productId: string, quantity = 1): Promise<Cart> {
    const updated = await runOnce(() => addMutation.mutateAsync({ productId, quantity }));
    if (updated == null) {
      // A duplicate call was ignored. Return the best authoritative snapshot
      // available without issuing a second Cart request.
      const cached = queryClient.getQueryData<CartDto>(queryKeys.cart.current());
      return cached != null ? mapCartDtoToCart(cached) : EMPTY_CART;
    }
    return mapCartDtoToCart(updated);
  }

  async function updateQuantity(id: string, quantity: number): Promise<void> {
    await runOnce(() => updateMutation.mutateAsync({ id, quantity }));
  }

  /** PATCH with an absolute quantity (never 0). */
  async function increaseQuantity(id: string): Promise<void> {
    const line = findLine(cart.items, id);
    if (line == null || !line.active || line.quantity >= line.availableStock) {
      return;
    }
    await updateQuantity(id, line.quantity + 1);
  }

  /** PATCH with an absolute quantity; a line is never driven below 1. */
  async function decreaseQuantity(id: string): Promise<void> {
    const line = findLine(cart.items, id);
    if (line == null || !line.active || line.quantity <= 1) {
      return;
    }
    await updateQuantity(id, line.quantity - 1);
  }

  async function removeItem(id: string): Promise<void> {
    await runOnce(() => deleteMutation.mutateAsync(id));
  }

  async function clearCart(): Promise<void> {
    await runOnce(() => clearMutation.mutateAsync());
  }

  return {
    items: cart.items,
    totalItems: cart.totalItems,
    subtotal: cart.subtotal,
    /** True only while a customer's first cart fetch is in flight. */
    isLoading: isCustomer && cartQuery.isPending,
    /** Any cart request in flight, including a background revalidation. */
    isFetching: isCustomer && cartQuery.isFetching,
    isError: cartQuery.isError,
    error: cartQuery.error,
    refetch: cartQuery.refetch,
    /** Cart is customer-only; screens use this to pick the right empty state. */
    isCustomer,
    isMutating,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearMutation.isPending,
    /** Last mutation failure, when a caller has not handled it locally. */
    mutationError:
      addMutation.error ??
      updateMutation.error ??
      deleteMutation.error ??
      clearMutation.error ??
      null,
    addItem,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
  };
}

function findLine(items: CartLine[], id: string): CartLine | undefined {
  return items.find((item) => item.id === id);
}
