/**
 * Tests for the COD Checkout screen.
 *
 * Real TanStack Query + AuthContext are used; only the Cart HTTP service and
 * the order checkout service are mocked. This keeps assertions on the public
 * flow: live cart resolution, address validation, exact request body, success
 * state and stale-cart recovery.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { User } from '../../types/auth';
import type { CartDto, CartItemDto } from '../../types/cartApi';
import type { OrderResponse } from '../../types/orderApi';
import type { VoucherResponse } from '../../types/voucherApi';
import { getCart } from '../../services/cartService';
import { createOrder } from '../../services/orderService';
import { validateVoucher } from '../../services/voucherService';
import CheckoutScreen from '../CheckoutScreen';

jest.mock('../../services/cartService', () => ({
  getCart: jest.fn(),
  addCartItem: jest.fn(),
  updateCartItem: jest.fn(),
  deleteCartItem: jest.fn(),
}));

jest.mock('../../services/orderService', () => ({
  createOrder: jest.fn(),
}));

jest.mock('../../services/voucherService', () => ({
  validateVoucher: jest.fn(),
}));

const mockedGetCart = getCart as jest.MockedFunction<typeof getCart>;
const mockedCreateOrder = createOrder as jest.MockedFunction<typeof createOrder>;
const mockedValidateVoucher = validateVoucher as jest.MockedFunction<typeof validateVoucher>;

type Navigation = AppNavigatorScreenProps<'Checkout'>['navigation'];

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

const ORDER: OrderResponse = {
  id: 'order-123',
  status: 'PENDING',
  paymentStatus: 'PENDING',
  paymentMethod: 'COD',
  paymentUrl: null,
  createdAt: '2026-10-23T10:00:00Z',
  shippingAddress: '12 Main Street',
  shippingFee: '0.00',
  discountAmount: '0.00',
  totalAmount: '123456.00',
  voucherCode: null,
  shipments: [],
  items: [
    {
      id: 'order-item-1',
      orderId: 'order-123',
      productId: 'p-a',
      productName: 'Product a',
      unitPrice: '100000.00',
      quantity: 1,
      status: 'PENDING',
      sellerId: 's-1',
    },
  ],
};

const VOUCHER_10: VoucherResponse = {
  code: 'WELCOME10',
  description: '10% discount on entire order',
  discountPercent: 10,
  validFrom: '2026-01-01T00:00:00Z',
  validTo: '2027-01-01T00:00:00Z',
  usageLimit: 1000,
  timesUsed: 0,
};

const ORDER_WITH_VOUCHER: OrderResponse = {
  ...ORDER,
  discountAmount: '15000.00',
  totalAmount: '135000.00',
  voucherCode: 'WELCOME10',
};

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

function renderScreen(
  user: User | null,
  cartItemIds: string[] = ['a'],
  navigation: Navigation = makeNavigation(),
) {
  const client = makeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={makeAuth(user)}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  const Wrapper = wrapper;
  const result = render(
    <Wrapper>
      <CheckoutScreen
        navigation={navigation}
        route={
          {
            key: 'Checkout',
            name: 'Checkout',
            params: { cartItemIds },
          } as never
        }
      />
    </Wrapper>,
  );

  return { client, navigation, ...result };
}

async function renderReady(
  cartItemIds: string[] = ['a'],
  user: User | null = CUSTOMER,
  navigation: Navigation = makeNavigation(),
) {
  const view = renderScreen(user, cartItemIds, navigation);
  await view.findByText('Selected items');
  return view;
}

async function fillAddress(view: ReturnType<typeof renderScreen>, value: string) {
  fireEvent.changeText(await view.findByLabelText('Shipping address'), value);
}

async function enterVoucher(view: ReturnType<typeof renderScreen>, value: string) {
  fireEvent.changeText(await view.findByLabelText('Voucher code input'), value);
}

describe('CheckoutScreen', () => {
  beforeEach(() => {
    mockedGetCart.mockReset();
    mockedCreateOrder.mockReset();
    mockedValidateVoucher.mockReset();
    mockedGetCart.mockResolvedValue(
      makeCart([
        makeLine('a', { name: 'Phone', lineTotal: '100000.00' }),
        makeLine('b', { name: 'Case', lineTotal: '50000.00' }),
      ]),
    );
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('renders selected items, COD, shipping fee/discount and the preview total', async () => {
    const view = await renderReady(['a', 'b']);

    expect(view.getByText('Phone')).toBeTruthy();
    expect(view.getByText('Case')).toBeTruthy();
    expect(view.getByText('Cash on delivery (COD)')).toBeTruthy();
    expect(view.getAllByText('150.000 ₫').length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText('0 ₫')).toHaveLength(2);
    expect(view.queryByText('VNPAY')).toBeNull();
    expect(view.queryByText('Voucher')).toBeNull();
  });

  it('requires a non-blank shipping address', async () => {
    const view = await renderReady();

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Shipping address is required.')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only shipping address', async () => {
    const view = await renderReady();
    await fillAddress(view, '   \n  ');

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Shipping address is required.')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('rejects meaningless punctuation addresses without letters', async () => {
    for (const value of ['', '!!!', '---', '...']) {
      const local = renderScreen(CUSTOMER, ['a']);
      await local.findByText('Selected items');
      await fillAddress(local, value);
      fireEvent.press(local.getByLabelText('Place Order'));
      if (value.trim().length === 0) {
        expect(await local.findByText('Shipping address is required.')).toBeTruthy();
      } else {
        expect(
          await local.findByText(
            value.trim().length < 5
              ? 'Shipping address must be at least 5 characters.'
              : 'Shipping address must contain letters.',
          ),
        ).toBeTruthy();
      }
      expect(mockedCreateOrder).not.toHaveBeenCalled();
      mockedCreateOrder.mockReset();
    }
  });

  it('rejects addresses with fewer than 5 trimmed characters or without letters', async () => {
    const view = await renderReady();

    await fillAddress(view, '1234');
    fireEvent.press(view.getByLabelText('Place Order'));
    expect(await view.findByText('Shipping address must be at least 5 characters.')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();

    await fillAddress(view, '12345');
    fireEvent.press(view.getByLabelText('Place Order'));
    expect(await view.findByText('Shipping address must contain letters.')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();

    const view2 = renderScreen(CUSTOMER, ['a']);
    await view2.findByText('Selected items');
    await fillAddress(view2, '12/3');
    fireEvent.press(view2.getByLabelText('Place Order'));
    expect(await view2.findByText('Shipping address must be at least 5 characters.')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('accepts valid Vietnamese addresses with numbers, punctuation and trimming', async () => {
    mockedCreateOrder.mockResolvedValue(ORDER);
    const view = await renderReady();

    await fillAddress(view, '  Gò Vấp  ');
    fireEvent.press(view.getByLabelText('Place Order'));
    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        cartItemIds: ['a'],
        shippingAddress: 'Gò Vấp',
        paymentMethod: 'COD',
      }),
    );

    mockedCreateOrder.mockResolvedValue(ORDER);
    const view2 = renderScreen(CUSTOMER, ['a']);
    await view2.findByText('Selected items');
    await fillAddress(view2, '12 Nguyễn Văn Bảo');
    fireEvent.press(view2.getByLabelText('Place Order'));
    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenLastCalledWith({
        cartItemIds: ['a'],
        shippingAddress: '12 Nguyễn Văn Bảo',
        paymentMethod: 'COD',
      }),
    );

    mockedCreateOrder.mockResolvedValue(ORDER);
    const view3 = renderScreen(CUSTOMER, ['a']);
    await view3.findByText('Selected items');
    await fillAddress(view3, '12/5 Nguyễn Văn Bảo, Gò Vấp');
    fireEvent.press(view3.getByLabelText('Place Order'));
    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenLastCalledWith({
        cartItemIds: ['a'],
        shippingAddress: '12/5 Nguyễn Văn Bảo, Gò Vấp',
        paymentMethod: 'COD',
      }),
    );

    mockedCreateOrder.mockResolvedValue(ORDER);
    const view4 = renderScreen(CUSTOMER, ['a']);
    await view4.findByText('Selected items');
    await fillAddress(view4, 'KTX Đại học Công nghiệp');
    fireEvent.press(view4.getByLabelText('Place Order'));
    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenLastCalledWith({
        cartItemIds: ['a'],
        shippingAddress: 'KTX Đại học Công nghiệp',
        paymentMethod: 'COD',
      }),
    );
  });

  it('rejects an address longer than 1000 characters', async () => {
    const view = await renderReady();
    await fillAddress(view, 'x'.repeat(1001));

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(
      await view.findByText('Shipping address must not exceed 1000 characters.'),
    ).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('submits exactly the selected ids, trimmed address and COD', async () => {
    mockedCreateOrder.mockResolvedValue(ORDER);
    const view = await renderReady(['a', 'b']);
    await fillAddress(view, '  12 Main Street  ');

    fireEvent.press(view.getByLabelText('Place Order'));

    await waitFor(() =>
      expect(mockedCreateOrder).toHaveBeenCalledWith({
        cartItemIds: ['a', 'b'],
        shippingAddress: '12 Main Street',
        paymentMethod: 'COD',
      }),
    );
  });

  it('disables Place Order while pending and prevents duplicate submission', async () => {
    let resolveOrder: (order: OrderResponse) => void = () => {};
    mockedCreateOrder.mockReturnValue(
      new Promise<OrderResponse>((resolve) => {
        resolveOrder = resolve;
      }),
    );
    const view = await renderReady();
    await fillAddress(view, '12 Main Street');

    const button = view.getByLabelText('Place Order');
    fireEvent.press(button);
    fireEvent.press(button);

    expect((await view.findByLabelText('Place Order')).props.accessibilityState).toMatchObject({
      busy: true,
      disabled: true,
    });
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveOrder(ORDER);
    });
    expect(await view.findByText('Order placed successfully')).toBeTruthy();
  });

  it('shows the backend total and PENDING statuses after success', async () => {
    mockedCreateOrder.mockResolvedValue(ORDER);
    const view = await renderReady();
    await fillAddress(view, '12 Main Street');

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Order placed successfully')).toBeTruthy();
    expect(view.getByText('order-123')).toBeTruthy();
    expect(view.getByText('Cash on delivery (COD)')).toBeTruthy();
    expect(view.getAllByText('Pending')).toHaveLength(2);
    expect(view.getByText('123.456 ₫')).toBeTruthy();
    expect(view.queryByText('PAID')).toBeNull();
    expect(view.queryByText('Paid')).toBeNull();
    expect(view.queryByText('Completed')).toBeNull();
    expect(view.queryByText('Delivered')).toBeNull();
    expect(view.getByText('12 Main Street')).toBeTruthy();
  });

  it('continues shopping to Home after success', async () => {
    mockedCreateOrder.mockResolvedValue(ORDER);
    const navigation = makeNavigation();
    const view = await renderReady(['a'], CUSTOMER, navigation);
    await fillAddress(view, '12 Main Street');
    fireEvent.press(view.getByLabelText('Place Order'));

    fireEvent.press(await view.findByLabelText('Continue Shopping'));

    expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'Home' });
  });

  it('shows backend shippingAddress field errors without parsing the message', async () => {
    mockedCreateOrder.mockRejectedValue(
      new ApiError('Validation failed', 'VALIDATION_ERROR', 400, {
        shippingAddress: 'Address is too long from server',
      }),
    );
    const view = await renderReady();
    await fillAddress(view, '12 Main Street');

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Validation failed')).toBeTruthy();
    expect(view.getByText('Address is too long from server')).toBeTruthy();
  });

  it.each([
    ['CART_ITEM_NOT_FOUND', 'Cart item not found'],
    ['PRODUCT_INACTIVE', 'Product is no longer available'],
    ['INSUFFICIENT_STOCK', 'Not enough stock'],
  ])('recovers from a stale cart on %s and refetches Cart', async (code, message) => {
    mockedCreateOrder.mockRejectedValue(new ApiError(message, code, code === 'INSUFFICIENT_STOCK' ? 409 : 400));
    const view = await renderReady();
    await fillAddress(view, '12 Main Street');

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Your cart changed')).toBeTruthy();
    expect(view.getByText(message)).toBeTruthy();
    expect(view.getByLabelText('Back to Cart')).toBeTruthy();
    await waitFor(() => expect(mockedGetCart).toHaveBeenCalledTimes(2));
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
  });

  it('refuses to submit when a route id no longer resolves to an available line', async () => {
    const view = renderScreen(CUSTOMER, ['missing']);

    expect(await view.findByText('Your cart changed')).toBeTruthy();
    expect(view.queryByLabelText('Place Order')).toBeNull();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('refuses to submit a selected line that became unavailable', async () => {
    mockedGetCart.mockResolvedValue(
      makeCart([makeLine('a', { name: 'Phone', active: false })]),
    );
    const view = renderScreen(CUSTOMER, ['a']);

    expect(await view.findByText('Your cart changed')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it('invalidates/refetches Cart after a successful order', async () => {
    mockedGetCart
      .mockResolvedValueOnce(makeCart([makeLine('a', { name: 'Phone' })]))
      .mockResolvedValue(makeCart([]));
    mockedCreateOrder.mockResolvedValue(ORDER);
    const view = await renderReady(['a']);
    await fillAddress(view, '12 Main Street');

    fireEvent.press(view.getByLabelText('Place Order'));

    expect(await view.findByText('Order placed successfully')).toBeTruthy();
    await waitFor(() => expect(mockedGetCart).toHaveBeenCalledTimes(2));
  });

  it('prompts guests to sign in and never calls checkout', async () => {
    const view = renderScreen(null);
    expect(await view.findByText('Sign in to checkout')).toBeTruthy();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it.each(['SELLER', 'ADMIN'] as const)(
    'blocks %s accounts from checkout',
    async (role) => {
      const view = renderScreen(makeUser(role));
      expect(await view.findByText('Customer accounts only')).toBeTruthy();
      expect(mockedCreateOrder).not.toHaveBeenCalled();
    },
  );

  describe('Checkout voucher validation & application', () => {
    it('renders voucher input field, Apply button, and platform voucher title', async () => {
      const view = await renderReady(['a', 'b']);

      expect(view.getByText('Platform voucher')).toBeTruthy();
      expect(view.getByLabelText('Voucher code input')).toBeTruthy();
      expect(view.getByLabelText('Apply voucher')).toBeTruthy();
    });

    it('shows error when Apply is pressed with empty or whitespace-only code without network call', async () => {
      const view = await renderReady(['a', 'b']);

      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('Please enter a voucher code.')).toBeTruthy();
      expect(mockedValidateVoucher).not.toHaveBeenCalled();

      await enterVoucher(view, '   ');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('Please enter a voucher code.')).toBeTruthy();
      expect(mockedValidateVoucher).not.toHaveBeenCalled();
    });

    it('validates voucher with trimmed code and updates discount and total preview', async () => {
      mockedValidateVoucher.mockResolvedValue(VOUCHER_10);
      const view = await renderReady(['a', 'b']); // Subtotal = 150.000 ₫

      await enterVoucher(view, '  welcome10  ');
      fireEvent.press(view.getByLabelText('Apply voucher'));

      await waitFor(() => {
        expect(mockedValidateVoucher).toHaveBeenCalledWith('welcome10');
      });

      expect(await view.findByText('WELCOME10')).toBeTruthy();
      expect(view.getByText('-10%')).toBeTruthy();
      expect(view.getByText('10% discount on entire order')).toBeTruthy();
      expect(view.getByLabelText('Remove voucher')).toBeTruthy();

      // Order summary discount preview: 150000 * 10% = 15000 ₫
      // Estimated total: 150000 - 15000 = 135000 ₫
      expect(view.getByText('-15.000 ₫')).toBeTruthy();
      expect(view.getByText('135.000 ₫')).toBeTruthy();
    });

    it('removes applied voucher when Remove is pressed and restores summary', async () => {
      mockedValidateVoucher.mockResolvedValue(VOUCHER_10);
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'WELCOME10');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('WELCOME10')).toBeTruthy();

      fireEvent.press(view.getByLabelText('Remove voucher'));

      expect(await view.findByLabelText('Voucher code input')).toBeTruthy();
      expect(view.queryByText('WELCOME10')).toBeNull();

      expect(view.getAllByText('150.000 ₫').length).toBeGreaterThanOrEqual(1);
      expect(view.getAllByText('0 ₫')).toHaveLength(2);
      expect(mockedValidateVoucher).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['RESOURCE_NOT_FOUND', 404, 'Voucher code not found. Please check and try again.'],
      ['VOUCHER_EXPIRED', 409, 'This voucher is not active at this time.'],
      ['VOUCHER_EXHAUSTED', 409, 'This voucher has reached its usage limit.'],
    ])('displays friendly error message for %s error', async (code, status, expectedMessage) => {
      mockedValidateVoucher.mockRejectedValue(new ApiError(expectedMessage, code, status));
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'TESTCODE');
      fireEvent.press(view.getByLabelText('Apply voucher'));

      expect(await view.findByText(expectedMessage)).toBeTruthy();
      expect(view.queryByText('TESTCODE')).toBeNull();
      expect(view.getAllByText('150.000 ₫').length).toBeGreaterThanOrEqual(1);
    });

    it('handles 401 and 403 errors when validating voucher', async () => {
      mockedValidateVoucher.mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401));
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'TESTCODE');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('Please sign in to apply vouchers.')).toBeTruthy();

      mockedValidateVoucher.mockRejectedValue(new ApiError('Forbidden', 'FORBIDDEN', 403));
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('Vouchers are available for customer accounts only.')).toBeTruthy();
    });

    it('submits checkout request with canonical voucherCode when voucher is applied', async () => {
      mockedValidateVoucher.mockResolvedValue(VOUCHER_10);
      mockedCreateOrder.mockResolvedValue(ORDER_WITH_VOUCHER);
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'welcome10');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('WELCOME10')).toBeTruthy();

      await fillAddress(view, '12 Main Street');
      fireEvent.press(view.getByLabelText('Place Order'));

      await waitFor(() =>
        expect(mockedCreateOrder).toHaveBeenCalledWith({
          cartItemIds: ['a', 'b'],
          shippingAddress: '12 Main Street',
          paymentMethod: 'COD',
          voucherCode: 'WELCOME10',
        }),
      );
    });

    it('submits checkout request with voucherCode undefined when no voucher applied', async () => {
      mockedCreateOrder.mockResolvedValue(ORDER);
      const view = await renderReady(['a']);

      await fillAddress(view, '12 Main Street');
      fireEvent.press(view.getByLabelText('Place Order'));

      await waitFor(() =>
        expect(mockedCreateOrder).toHaveBeenCalledWith({
          cartItemIds: ['a'],
          shippingAddress: '12 Main Street',
          paymentMethod: 'COD',
          voucherCode: undefined,
        }),
      );
    });

    it('displays authoritative voucher code, discount amount and total in order confirmation', async () => {
      mockedValidateVoucher.mockResolvedValue(VOUCHER_10);
      mockedCreateOrder.mockResolvedValue(ORDER_WITH_VOUCHER);
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'WELCOME10');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      await fillAddress(view, '12 Main Street');
      fireEvent.press(view.getByLabelText('Place Order'));

      expect(await view.findByText('Order placed successfully')).toBeTruthy();
      expect(view.getByText('order-123')).toBeTruthy();
      expect(view.getByText('Voucher')).toBeTruthy();
      expect(view.getByText('WELCOME10')).toBeTruthy();
      expect(view.getByText('-15.000 ₫')).toBeTruthy();
      expect(view.getByText('135.000 ₫')).toBeTruthy();
    });

    it.each([
      ['VOUCHER_EXHAUSTED', 'This voucher has reached its usage limit. Please try another or continue without a voucher.'],
      ['VOUCHER_EXPIRED', 'This voucher is no longer active. Please try another or continue without a voucher.'],
    ])('clears voucher and shows error without automatic retry on checkout error %s', async (code, message) => {
      mockedValidateVoucher.mockResolvedValue(VOUCHER_10);
      mockedCreateOrder.mockRejectedValue(new ApiError(message, code, 409));
      const view = await renderReady(['a', 'b']);

      await enterVoucher(view, 'WELCOME10');
      fireEvent.press(view.getByLabelText('Apply voucher'));
      expect(await view.findByText('WELCOME10')).toBeTruthy();

      await fillAddress(view, '12 Main Street');
      fireEvent.press(view.getByLabelText('Place Order'));

      expect(await view.findByText(message)).toBeTruthy();
      expect(view.queryByText('WELCOME10')).toBeNull();
      expect(view.getByLabelText('Voucher code input')).toBeTruthy();
      expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
      expect(view.getByLabelText('Place Order')).toBeTruthy();
    });
  });
});
