/**
 * Checkout mutation built on TanStack Query.
 *
 * There are no optimistic updates and no automatic retries: the backend has no
 * idempotency key, so a checkout must only run once per explicit user action.
 * The returned `placeOrder` also guards against two taps in the same tick.
 *
 * On success the purchased cart lines are already gone on the server, so the
 * authoritative cart query is invalidated/refetched instead of being mutated
 * locally. The existing orders prefix is invalidated as well (there are no
 * order-list queries in this feature).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { queryKeys } from '../api/queryKeys';
import { createOrder } from '../services/orderService';
import type { CheckoutRequest, OrderResponse } from '../types/orderApi';

export function useCheckout() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  const mutation = useMutation({
    // Wrapped so the service receives exactly the checkout request.
    mutationFn: (input: CheckoutRequest) => createOrder(input),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.cart.current() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
      ]);
    },
  });

  /**
   * Submits a checkout once. A duplicate call in the same tick resolves to
   * null without contacting the backend.
   */
  async function placeOrder(input: CheckoutRequest): Promise<OrderResponse | null> {
    if (inFlightRef.current) {
      return null;
    }
    inFlightRef.current = true;
    try {
      return await mutation.mutateAsync(input);
    } finally {
      inFlightRef.current = false;
    }
  }

  return {
    placeOrder,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
