/**
 * Customer order hooks.
 *
 * - `useOrders`: paginated, newest-first customer order history. Uses an
 *   infinite query so My Orders loads page 0 first and then appends pages
 *   while `last` is false.
 * - `useOrderDetail`: one order (backend enforces ownership; 404 otherwise).
 * - `useConfirmReceived`: DELIVERED -> COMPLETED mutation. On success the
 *   returned OrderResponse is written into the detail cache and the order
 *   list is invalidated so summaries refresh (including auto-completed ones).
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { confirmReceived, getOrder, getOrders } from '../services/orderService';
import { queryKeys } from '../api/queryKeys';
import type { OrderResponse } from '../types/orderApi';

/** Backend default page size (max 100). */
export const ORDERS_PAGE_SIZE = 20;

export function useOrders(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.orders.lists,
    queryFn: ({ pageParam }) => getOrders(pageParam, ORDERS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.last) {
        return undefined;
      }
      const totalPages = lastPage.totalPages;
      const currentPage = lastPage.page;
      if (typeof totalPages === 'number' && totalPages >= 0) {
        if (currentPage + 1 >= totalPages) {
          return undefined;
        }
      }
      return currentPage + 1;
    },
    enabled,
  });
}

export function useOrderDetail(orderId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => getOrder(orderId),
    enabled: enabled && orderId.length > 0,
  });
}

export function useConfirmReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => confirmReceived(orderId),
    onSuccess: (updatedOrder: OrderResponse) => {
      // Detail becomes COMPLETED immediately from the authoritative response.
      queryClient.setQueryData(queryKeys.orders.detail(updatedOrder.id), updatedOrder);
      // Summaries (and every list page) must not stay stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
    },
  });
}
