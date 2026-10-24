/**
 * Tests for the server-backed `useCart` facade.
 *
 * A real TanStack Query client and a real AuthContext provider are used; only
 * the cart service (HTTP boundary) is mocked. This keeps the tests on the
 * public contract: query enablement, derived totals, absolute-vs-delta
 * semantics, cache replacement and error propagation.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import { ApiError } from '../../api/errors';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext';
import type { User } from '../../types/auth';
import type { CartDto, CartItemDto } from '../../types/cartApi';
import {
  addCartItem,
  deleteCartItem,
  getCart,
  updateCartItem,
} from '../../services/cartService';
import { useCart } from '../useCart';

jest.mock('../../services/cartService', () => ({
  getCart: jest.fn(),
  addCartItem: jest.fn(),
  updateCartItem: jest.fn(),
  deleteCartItem: jest.fn(),
}));

const mockedGetCart = getCart as jest.MockedFunction<typeof getCart>;
const mockedAddCartItem = addCartItem as jest.MockedFunction<typeof addCartItem>;
const mockedUpdateCartItem = updateCartItem as jest.MockedFunction<typeof updateCartItem>;
const mockedDeleteCartItem = deleteCartItem as jest.MockedFunction<typeof deleteCartItem>;

const USER: User = {
  id: 'u-1',
  email: 'customer@example.com',
  name: 'Customer',
  role: 'CUSTOMER',
};

function makeUser(role: User['role']): User {
  return { ...USER, id: `u-${role}`, role };
}

function makeAuth(user: User | null): AuthContextValue {
  return {
    user,
    isAuthenticated: user != null,
    isRestoring: false,
    login: jest.fn(async () => {}),
    register: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
  };
}

function makeLine(id: string, overrides: Partial<CartItemDto> = {}): CartItemDto {
  return {
    id,
    productId: `p-${id}`,
    name: `Product ${id}`,
    imageUrl: null,
    unitPrice: '100.00',
    quantity: 1,
    lineTotal: '100.00',
    availableStock: 10,
    active: true,
    sellerId: 's-1',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function makeCart(items: CartItemDto[], subtotal = '0.00'): CartDto {
  return { items, subtotal };
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function renderCart(user: User | null, client: QueryClient = makeClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={makeAuth(user)}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  return { ...renderHook(() => useCart(), { wrapper }), client };
}

describe('useCart', () => {
  beforeEach(() => {
    mockedGetCart.mockReset();
    mockedAddCartItem.mockReset();
    mockedUpdateCartItem.mockReset();
    mockedDeleteCartItem.mockReset();
  });

  it('enables the cart query for an authenticated CUSTOMER', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('a', { quantity: 2 }), makeLine('b', { quantity: 1 })], '300.00'),
    );

    const { result } = renderCart(USER);

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(mockedGetCart).toHaveBeenCalledTimes(1);
    expect(result.current.isCustomer).toBe(true);
    expect(result.current.totalItems).toBe(3);
  });

  it('uses the backend subtotal rather than recomputing it from lines', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('a', { quantity: 2, lineTotal: '200.00' })], '123.45'),
    );

    const { result } = renderCart(USER);

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.subtotal).toBe(123.45);
  });

  it('disables the query for guests', () => {
    const { result } = renderCart(null);

    expect(mockedGetCart).not.toHaveBeenCalled();
    expect(result.current.isCustomer).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it.each(['SELLER', 'ADMIN'] as const)('disables the query for %s accounts', (role) => {
    const { result } = renderCart(makeUser(role));

    expect(mockedGetCart).not.toHaveBeenCalled();
    expect(result.current.isCustomer).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
  });

  it('adds through the service and stores the returned authoritative cart', async () => {
    mockedGetCart.mockResolvedValue(makeCart([]));
    const updated = makeCart([makeLine('cart-item-1', { quantity: 2 })], '200.00');
    mockedAddCartItem.mockResolvedValue(updated);

    const { result, client } = renderCart(USER);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned: Awaited<ReturnType<typeof result.current.addItem>> | undefined;
    await act(async () => {
      returned = await result.current.addItem('p-1', 2);
    });

    expect(mockedAddCartItem.mock.calls[0][0]).toEqual({ productId: 'p-1', quantity: 2 });
    expect(client.getQueryData(queryKeys.cart.current())).toEqual(updated);
    // Buy Now relies on this mapped authoritative result to resolve line.id.
    expect(returned?.items[0].id).toBe('cart-item-1');
    expect(returned?.items[0].lineTotal).toBe(100);
    expect(returned?.subtotal).toBe(200);
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.totalItems).toBe(2);
  });

  it('sends an ABSOLUTE quantity on update', async () => {
    mockedGetCart.mockResolvedValue(makeCart([makeLine('cart-item-1', { quantity: 2 })]));
    mockedUpdateCartItem.mockResolvedValue(
      makeCart([makeLine('cart-item-1', { quantity: 4 })]),
    );

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.updateQuantity('cart-item-1', 4);
    });

    expect(mockedUpdateCartItem).toHaveBeenCalledWith('cart-item-1', { quantity: 4 });
  });

  it('increase/decrease send current ± 1 as an absolute quantity', async () => {
    mockedGetCart.mockResolvedValue(makeCart([makeLine('cart-item-1', { quantity: 2 })]));
    mockedUpdateCartItem.mockResolvedValue(
      makeCart([makeLine('cart-item-1', { quantity: 3 })]),
    );

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.increaseQuantity('cart-item-1');
    });
    expect(mockedUpdateCartItem).toHaveBeenLastCalledWith('cart-item-1', { quantity: 3 });

    await waitFor(() => expect(result.current.items[0].quantity).toBe(3));

    await act(async () => {
      await result.current.decreaseQuantity('cart-item-1');
    });
    // Still absolute, computed from the refreshed quantity (3 -> 2).
    expect(mockedUpdateCartItem).toHaveBeenLastCalledWith('cart-item-1', { quantity: 2 });
  });

  it('never PATCHes a quantity of 0 at the minimum', async () => {
    mockedGetCart.mockResolvedValue(makeCart([makeLine('cart-item-1', { quantity: 1 })]));

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.decreaseQuantity('cart-item-1');
    });

    expect(mockedUpdateCartItem).not.toHaveBeenCalled();
  });

  it('does not increase an inactive or fully-stocked line', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([
        makeLine('inactive', { active: false }),
        makeLine('full', { quantity: 3, availableStock: 3 }),
      ]),
    );

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.increaseQuantity('inactive');
      await result.current.increaseQuantity('full');
    });

    expect(mockedUpdateCartItem).not.toHaveBeenCalled();
  });

  it('deletes by cart-item id, not product id', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('cart-item-1', { productId: 'p-1' })]),
    );
    mockedDeleteCartItem.mockResolvedValue(makeCart([]));

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await result.current.removeItem('cart-item-1');
    });

    expect(mockedDeleteCartItem).toHaveBeenCalledWith('cart-item-1');
    expect(mockedDeleteCartItem).not.toHaveBeenCalledWith('p-1');
    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it('surfaces a normalized server error and keeps the cache intact', async () => {
    mockedGetCart.mockResolvedValue(makeCart([makeLine('cart-item-1', { quantity: 1 })]));
    const apiError = new ApiError('Only 3 item(s) left in stock', 'INSUFFICIENT_STOCK', 409);
    mockedAddCartItem.mockRejectedValue(apiError);

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.addItem('p-1', 5);
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBe(apiError);
    await waitFor(() => expect(result.current.mutationError).toBe(apiError));
    expect(result.current.items).toHaveLength(1);
  });

  it('ignores duplicate submissions while a mutation is in flight', async () => {
    mockedGetCart.mockResolvedValue(makeCart([]));
    mockedAddCartItem.mockResolvedValue(makeCart([makeLine('cart-item-1')]));

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await Promise.all([
        result.current.addItem('p-1', 1),
        result.current.addItem('p-1', 1),
      ]);
    });

    expect(mockedAddCartItem).toHaveBeenCalledTimes(1);
  });

  it('clearCart deletes every cart-item id through the existing DELETE call', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('a'), makeLine('b')], '200.00'),
    );
    mockedDeleteCartItem
      .mockResolvedValueOnce(makeCart([makeLine('b')], '100.00'))
      .mockResolvedValueOnce(makeCart([], '0.00'));

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      await result.current.clearCart();
    });

    expect(mockedDeleteCartItem).toHaveBeenNthCalledWith(1, 'a');
    expect(mockedDeleteCartItem).toHaveBeenNthCalledWith(2, 'b');
    expect(mockedDeleteCartItem).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(result.current.subtotal).toBe(0);
  });

  it('refetches the authoritative cart when clearCart fails part-way', async () => {
    const partial = makeCart([makeLine('b')], '100.00');
    mockedGetCart.mockResolvedValueOnce(makeCart([makeLine('a'), makeLine('b')], '200.00'));
    mockedGetCart.mockResolvedValueOnce(partial);
    mockedDeleteCartItem
      .mockResolvedValueOnce(partial)
      .mockRejectedValueOnce(new ApiError('Unable to connect to the server.', 'NETWORK_ERROR', null));

    const { result } = renderCart(USER);
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(async () => {
      try {
        await result.current.clearCart();
      } catch {
        // The screen shows the normalized message; the hook only refetches.
      }
    });

    // The first DELETE response was not written optimistically; a refetch
    // restores whatever the backend actually holds.
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].id).toBe('b');
    expect(mockedGetCart).toHaveBeenCalledTimes(2);
  });
});
