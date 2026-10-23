/**
 * Tests for CartScreen against the server-backed cart.
 *
 * A real TanStack Query client and a real AuthContext provider are used; only
 * the cart HTTP service is mocked. Assertions stay on user-visible behavior
 * (states, totals, availability text, navigation) rather than styling.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext';
import type { MainTabScreenProps } from '../../navigation/types';
import type { User } from '../../types/auth';
import type { CartDto, CartItemDto } from '../../types/cartApi';
import { deleteCartItem, getCart, updateCartItem } from '../../services/cartService';
import CartScreen from '../CartScreen';

jest.mock('../../services/cartService', () => ({
  getCart: jest.fn(),
  addCartItem: jest.fn(),
  updateCartItem: jest.fn(),
  deleteCartItem: jest.fn(),
}));

const mockedGetCart = getCart as jest.MockedFunction<typeof getCart>;
const mockedUpdateCartItem = updateCartItem as jest.MockedFunction<typeof updateCartItem>;
const mockedDeleteCartItem = deleteCartItem as jest.MockedFunction<typeof deleteCartItem>;

type Navigation = MainTabScreenProps<'Cart'>['navigation'];

const CUSTOMER: User = {
  id: 'u-1',
  email: 'customer@example.com',
  name: 'Customer',
  role: 'CUSTOMER',
};

function makeUser(role: User['role']): User {
  return { ...CUSTOMER, id: `u-${role}`, role };
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
    unitPrice: '100000.00',
    quantity: 1,
    lineTotal: '100000.00',
    availableStock: 5,
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

function makeNavigation(): Navigation {
  return { navigate: jest.fn() } as unknown as Navigation;
}

function renderScreen(user: User | null, navigation: Navigation = makeNavigation()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={makeClient()}>
      <AuthContext.Provider value={makeAuth(user)}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  const Wrapper = wrapper;

  return {
    navigation,
    ...render(
      <Wrapper>
        <CartScreen navigation={navigation} route={{ key: 'Cart', name: 'Cart' } as never} />
      </Wrapper>,
    ),
  };
}

describe('CartScreen', () => {
  beforeEach(() => {
    mockedGetCart.mockReset();
    mockedUpdateCartItem.mockReset();
    mockedDeleteCartItem.mockReset();
  });

  afterEach(async () => {
    // FlatList schedules a 50 ms cells-to-render update; let it run inside act
    // so it cannot fire after the test (Jest "did not exit" / act warnings).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
  });

  it('shows a loading state while the customer cart is being fetched', async () => {
    let resolveCart: (cart: CartDto) => void = () => {};
    mockedGetCart.mockImplementation(
      () =>
        new Promise<CartDto>((resolve) => {
          resolveCart = resolve;
        }),
    );

    const { getByText } = renderScreen(CUSTOMER);

    expect(getByText('Loading your cart…')).toBeTruthy();

    // Resolve before the test ends so no query is left in flight.
    await act(async () => {
      resolveCart(makeCart([]));
    });
  });

  it('renders the empty state for a successful empty cart', async () => {
    mockedGetCart.mockResolvedValue(makeCart([]));

    const { findByText } = renderScreen(CUSTOMER);

    expect(await findByText('Your cart is empty')).toBeTruthy();
    expect(await findByText('Continue Shopping')).toBeTruthy();
  });

  it('navigates to Home when Continue Shopping is pressed', async () => {
    mockedGetCart.mockResolvedValue(makeCart([]));

    const { findByLabelText, navigation } = renderScreen(CUSTOMER);

    fireEvent.press(await findByLabelText('Continue shopping'));

    expect(navigation.navigate).toHaveBeenCalledWith('Home');
  });

  it('renders server lines, the backend subtotal and the item count', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart(
        [
          makeLine('a', { name: 'Phone', quantity: 2, lineTotal: '200000.00' }),
          makeLine('b', { name: 'Case', quantity: 1, lineTotal: '50000.00' }),
        ],
        '250000.00',
      ),
    );

    const { findByText, getByText } = renderScreen(CUSTOMER);

    expect(await findByText('Phone')).toBeTruthy();
    expect(getByText('Case')).toBeTruthy();
    expect(getByText('250.000 ₫')).toBeTruthy();
    expect(getByText('3 items')).toBeTruthy();
    expect(getByText('3 items in your cart')).toBeTruthy();
  });

  it('keeps unavailable lines visible with a status and anchors the action to the cart-item id', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([
        makeLine('a', { name: 'Gone', active: false }),
        makeLine('b', { name: 'Sold Out', availableStock: 0, quantity: 1 }),
        makeLine('c', { name: 'Scarce', availableStock: 2, quantity: 3 }),
      ]),
    );
    mockedDeleteCartItem.mockResolvedValue(makeCart([]));

    const { findByText, getByText, getByLabelText } = renderScreen(CUSTOMER);

    expect(await findByText('Gone')).toBeTruthy();
    expect(getByText('Unavailable')).toBeTruthy();
    expect(getByText('Out of stock')).toBeTruthy();
    expect(getByText('Only 2 left in stock')).toBeTruthy();
    expect(getByText('Excludes unavailable items.')).toBeTruthy();

    fireEvent.press(getByLabelText('Remove Gone from cart'));

    await waitFor(() => expect(mockedDeleteCartItem).toHaveBeenCalledWith('a'));
  });

  it('sends an absolute incremented quantity for a row', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('cart-item-a', { name: 'Phone', quantity: 2 })], '200000.00'),
    );
    mockedUpdateCartItem.mockResolvedValue(
      makeCart([makeLine('cart-item-a', { name: 'Phone', quantity: 3 })], '300000.00'),
    );

    const { findByLabelText } = renderScreen(CUSTOMER);

    fireEvent.press(await findByLabelText('Increase quantity of Phone'));

    await waitFor(() =>
      expect(mockedUpdateCartItem).toHaveBeenCalledWith('cart-item-a', { quantity: 3 }),
    );
  });

  it('prompts guests to sign in and never requests the cart', () => {
    const { getByText, getByLabelText, navigation } = renderScreen(null);

    expect(getByText('Sign in to use your cart')).toBeTruthy();
    expect(mockedGetCart).not.toHaveBeenCalled();

    fireEvent.press(getByLabelText('Log in'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });

  it.each(['SELLER', 'ADMIN'] as const)(
    'shows the customer-only state for %s without calling the cart API',
    (role) => {
      const { getByText } = renderScreen(makeUser(role));

      expect(getByText('Cart is available for customer accounts only.')).toBeTruthy();
      expect(mockedGetCart).not.toHaveBeenCalled();
    },
  );

  it('shows a normalized error with Retry and recovers on retry', async () => {
    mockedGetCart
      .mockRejectedValueOnce(
        new ApiError('Unable to connect to the server. Please try again.', 'NETWORK_ERROR', null),
      )
      .mockResolvedValueOnce(makeCart([]));

    const { findByText, getByText, getByLabelText } = renderScreen(CUSTOMER);

    expect(await findByText("Couldn't load your cart")).toBeTruthy();
    expect(getByText('Unable to connect to the server. Please try again.')).toBeTruthy();

    fireEvent.press(getByLabelText('Retry loading cart'));

    expect(await findByText('Your cart is empty')).toBeTruthy();
    expect(mockedGetCart).toHaveBeenCalledTimes(2);
  });
});
