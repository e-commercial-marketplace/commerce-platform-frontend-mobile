/**
 * Unit tests for the cart API service.
 *
 * Only the transport contract is asserted: HTTP method, path, body and the
 * ApiResponse unwrap. Error propagation is checked with a backend error
 * envelope (the real `unwrapData` converts it to ApiError).
 */

import { apiClient } from '../../api/client';
import { ApiError, NETWORK_ERROR_CODE } from '../../api/errors';
import type { CartDto } from '../../types/cartApi';
import {
  addCartItem,
  deleteCartItem,
  getCart,
  updateCartItem,
} from '../cartService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const cart: CartDto = {
  items: [
    {
      id: 'cart-item-1',
      productId: 'p-1',
      name: 'iPhone 15 Pro',
      imageUrl: null,
      unitPrice: '29990000.00',
      quantity: 2,
      lineTotal: '59980000.00',
      availableStock: 8,
      active: true,
      sellerId: 's-1',
      createdAt: '2026-10-01T10:00:00Z',
    },
  ],
  subtotal: '59980000.00',
};

/** Minimal successful ApiResponse envelope. */
const successEnvelope = (data: CartDto) => ({
  data: { success: true, data },
  status: 200,
});

describe('cartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getCart uses GET /cart and unwraps the envelope', async () => {
    mockedClient.get.mockResolvedValue(successEnvelope(cart) as never);

    await expect(getCart()).resolves.toEqual(cart);
    expect(mockedClient.get).toHaveBeenCalledWith('/cart');
  });

  it('addCartItem posts productId + quantity to /cart/items', async () => {
    mockedClient.post.mockResolvedValue(successEnvelope(cart) as never);

    await expect(addCartItem({ productId: 'p-1', quantity: 2 })).resolves.toEqual(cart);
    expect(mockedClient.post).toHaveBeenCalledWith('/cart/items', {
      productId: 'p-1',
      quantity: 2,
    });
  });

  it('updateCartItem patches the cart-item id with an absolute quantity', async () => {
    mockedClient.patch.mockResolvedValue(successEnvelope(cart) as never);

    await expect(updateCartItem('cart-item-1', { quantity: 4 })).resolves.toEqual(cart);
    expect(mockedClient.patch).toHaveBeenCalledWith('/cart/items/cart-item-1', {
      quantity: 4,
    });
  });

  it('deleteCartItem deletes by cart-item id', async () => {
    mockedClient.delete.mockResolvedValue(successEnvelope(cart) as never);

    await expect(deleteCartItem('cart-item-1')).resolves.toEqual(cart);
    expect(mockedClient.delete).toHaveBeenCalledWith('/cart/items/cart-item-1');
  });

  it('surfaces a backend error envelope as ApiError', async () => {
    mockedClient.post.mockResolvedValue({
      data: {
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Only 3 item(s) left in stock',
        },
      },
      status: 409,
    } as never);

    await expect(addCartItem({ productId: 'p-1', quantity: 5 })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INSUFFICIENT_STOCK',
      status: 409,
      message: 'Only 3 item(s) left in stock',
    });
  });

  it('propagates transport errors unchanged', async () => {
    const networkError = new ApiError(
      'Unable to connect to the server. Please try again.',
      NETWORK_ERROR_CODE,
      null,
    );
    mockedClient.get.mockRejectedValue(networkError);

    await expect(getCart()).rejects.toBe(networkError);
  });
});
