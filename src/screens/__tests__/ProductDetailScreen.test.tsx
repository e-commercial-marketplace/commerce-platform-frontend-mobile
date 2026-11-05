/**
 * Buy Now handoff & Customer Chat Entry tests.
 *
 * The screen's data/cart/chat hooks are mocked so tests focus on the flows:
 * - Cart flow: add selected quantity through the real cart mutation contract, find resulting cart line by productId, then navigate to Checkout.
 * - Human Chat flow: Customer starts/opens a conversation with Seller from Product Detail.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';

import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { User } from '../../types/auth';
import type { Cart } from '../../types/cart';
import type { Product } from '../../types/product';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useOpenConversation } from '../../hooks/useChat';
import { useProductDetail } from '../../hooks/useProducts';
import { useSellerShop } from '../../hooks/useSellers';
import ProductDetailScreen from '../ProductDetailScreen';

jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useCart', () => ({ useCart: jest.fn() }));
jest.mock('../../hooks/useChat', () => ({ useOpenConversation: jest.fn() }));
jest.mock('../../hooks/useProducts', () => ({ useProductDetail: jest.fn() }));
jest.mock('../../hooks/useSellers', () => ({ useSellerShop: jest.fn() }));
const EMPTY_REVIEWS = { content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 };
jest.mock('../../hooks/useReviews', () => ({
  useProductReviews: jest.fn(() => ({
    data: EMPTY_REVIEWS,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useCreateReview: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCart = useCart as jest.MockedFunction<typeof useCart>;
const mockedUseOpenConversation = useOpenConversation as jest.MockedFunction<typeof useOpenConversation>;
const mockedUseProductDetail = useProductDetail as jest.MockedFunction<typeof useProductDetail>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

type Navigation = AppNavigatorScreenProps<'ProductDetail'>['navigation'];

const CUSTOMER: User = {
  id: 'u-1',
  email: 'customer@example.com',
  name: 'Customer',
  role: 'CUSTOMER',
};

const PRODUCT: Product = {
  id: 'p-target',
  name: 'Target Phone',
  price: 100000,
  image: 1,
  rating: 4.5,
  reviewCount: 3,
  category: 'Phones',
  description: 'A phone.',
  sellerId: 's-1',
  stock: 10,
};

function makeLine(id: string, productId: string, quantity = 1) {
  return {
    id,
    productId,
    name: `Product ${productId}`,
    image: 1,
    unitPrice: 100000,
    lineTotal: 100000 * quantity,
    quantity,
    availableStock: 10,
    active: true,
    sellerId: 's-1',
    createdAt: '2026-10-01T10:00:00Z',
    available: true,
  };
}

function renderScreen(
  addItem: jest.Mock = jest.fn(),
  navigation: Navigation = { navigate: jest.fn() } as unknown as Navigation,
  authOverride?: Partial<ReturnType<typeof useAuth>>,
) {
  mockedUseAuth.mockReturnValue({
    user: CUSTOMER,
    isAuthenticated: true,
    isRestoring: false,
    login: jest.fn(async () => {}),
    register: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
    changePassword: jest.fn(async () => {}),
    updateUserName: jest.fn(),
    ...authOverride,
  });
  mockedUseCart.mockReturnValue({ addItem } as never);
  mockedUseProductDetail.mockReturnValue({
    data: PRODUCT,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as never);
  mockedUseSellerShop.mockReturnValue({ data: { id: 's-1', name: 'Official Store' } } as never);

  return {
    navigation,
    ...render(
      <ProductDetailScreen
        navigation={navigation}
        route={
          {
            key: 'ProductDetail',
            name: 'ProductDetail',
            params: { productId: PRODUCT.id },
          } as never
        }
      />,
    ),
  };
}

describe('ProductDetailScreen', () => {
  const mockOpenConversationMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseOpenConversation.mockReturnValue({
      mutateAsync: mockOpenConversationMutateAsync,
      isPending: false,
    } as any);
  });

  describe('Buy Now & Cart Integration', () => {
    it('uses the returned cart and finds the line by productId, not items[0]', async () => {
      const updatedCart: Cart = {
        items: [makeLine('cart-other', 'p-other'), makeLine('cart-target', PRODUCT.id)],
        subtotal: 200000,
        totalItems: 2,
      };
      const addItem = jest.fn().mockResolvedValue(updatedCart);
      const { getByLabelText, navigation } = renderScreen(addItem);

      fireEvent.press(getByLabelText('Buy Now'));

      await waitFor(() =>
        expect(navigation.navigate).toHaveBeenCalledWith('Checkout', {
          cartItemIds: ['cart-target'],
        }),
      );
      expect(addItem).toHaveBeenCalledWith(PRODUCT.id, 1);
    });

    it('uses the merged existing cart line returned by the backend', async () => {
      const updatedCart: Cart = {
        items: [makeLine('cart-existing', PRODUCT.id, 4)],
        subtotal: 400000,
        totalItems: 4,
      };
      const addItem = jest.fn().mockResolvedValue(updatedCart);
      const { getByLabelText, navigation } = renderScreen(addItem);

      fireEvent.press(getByLabelText('Buy Now'));

      await waitFor(() =>
        expect(navigation.navigate).toHaveBeenCalledWith('Checkout', {
          cartItemIds: ['cart-existing'],
        }),
      );
    });
  });

  describe('Customer Start Conversation with Seller (Phase 5A)', () => {
    it('renders "Message the shop" button for authenticated Customer', () => {
      const { getByText } = renderScreen();
      expect(getByText('Message the shop')).toBeTruthy();
    });

    it('calls openConversation with actual sellerId and productId without customerId', async () => {
      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-new-1',
        customerId: 'u-1',
        sellerId: 's-1',
        productId: 'p-target',
        orderId: null,
        createdAt: '2026-10-30T10:00:00Z',
        lastMessageAt: null,
      });

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(jest.fn(), mockNav);

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      const callPayload = mockOpenConversationMutateAsync.mock.calls[0][0];
      expect(callPayload.sellerId).toBe('s-1');
      expect(callPayload.productId).toBe('p-target');
      // Critical check: customerId MUST NOT be sent in request body
      expect(callPayload.customerId).toBeUndefined();

      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-new-1',
        counterpartName: 'Official Store',
        counterpartRole: 'SELLER',
      });
    });

    it('navigates to ChatRoom when backend returns existing conversation (200 OK)', async () => {
      mockOpenConversationMutateAsync.mockResolvedValueOnce({
        id: 'conv-existing-88',
        customerId: 'u-1',
        sellerId: 's-1',
        productId: null,
        orderId: null,
        createdAt: '2026-10-25T10:00:00Z',
        lastMessageAt: '2026-10-30T09:00:00Z',
      });

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(jest.fn(), mockNav);

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      expect(mockNav.navigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-existing-88',
        counterpartName: 'Official Store',
        counterpartRole: 'SELLER',
      });
    });

    it('prevents double tap when openConversation mutation is pending', () => {
      mockedUseOpenConversation.mockReturnValue({
        mutateAsync: mockOpenConversationMutateAsync,
        isPending: true,
      } as any);

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByRole } = renderScreen(jest.fn(), mockNav);

      const chatButton = getByRole('button', { name: 'Message the shop' });
      fireEvent.press(chatButton);

      expect(mockOpenConversationMutateAsync).not.toHaveBeenCalled();
      expect(mockNav.navigate).not.toHaveBeenCalled();
    });

    it('displays error and does not navigate when openConversation fails', async () => {
      mockOpenConversationMutateAsync.mockRejectedValueOnce(
        new ApiError('Could not connect to the server', 'NETWORK_ERROR', null),
      );

      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(jest.fn(), mockNav);

      fireEvent.press(getByText('Message the shop'));

      await waitFor(() => {
        expect(mockOpenConversationMutateAsync).toHaveBeenCalledTimes(1);
      });

      expect(mockNav.navigate).not.toHaveBeenCalled();
      expect(getByText('Could not connect to the server')).toBeTruthy();
    });

    it('navigates guest to Login when "Message the shop" is pressed', () => {
      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(jest.fn(), mockNav, {
        user: null,
        isAuthenticated: false,
      });

      fireEvent.press(getByText('Message the shop'));

      expect(mockNav.navigate).toHaveBeenCalledWith('Login');
      expect(mockOpenConversationMutateAsync).not.toHaveBeenCalled();
    });

    it('hides "Message the shop" button for SELLER role', () => {
      const { queryByText } = renderScreen(jest.fn(), undefined, {
        user: { ...CUSTOMER, role: 'SELLER' },
        isAuthenticated: true,
      });
      expect(queryByText('Message the shop')).toBeNull();
    });

    it('hides "Message the shop" button for ADMIN role', () => {
      const { queryByText } = renderScreen(jest.fn(), undefined, {
        user: { ...CUSTOMER, role: 'ADMIN' },
        isAuthenticated: true,
      });
      expect(queryByText('Message the shop')).toBeNull();
    });
  });

  describe('Reviews Integration', () => {
    it('renders customer reviews section with aggregate summary', () => {
      const { getByText } = renderScreen();
      expect(getByText('Customer Reviews')).toBeTruthy();
      expect(getByText('No reviews yet')).toBeTruthy();
    });

    it('navigates guest to Login when Write a Review is pressed', () => {
      const mockNav = { navigate: jest.fn() } as unknown as Navigation;
      const { getByText } = renderScreen(jest.fn(), mockNav, {
        user: null,
        isAuthenticated: false,
      });

      fireEvent.press(getByText('Write a Review'));
      expect(mockNav.navigate).toHaveBeenCalledWith('Login');
    });

    it('opens WriteReviewModal when customer clicks Write a Review', () => {
      const { getByText, getByPlaceholderText } = renderScreen();
      fireEvent.press(getByText('Write a Review'));
      expect(getByPlaceholderText('What did you think of the product?')).toBeTruthy();
    });

    it('hides Write a Review button for seller/admin accounts', () => {
      const { queryByText } = renderScreen(jest.fn(), undefined, {
        user: { ...CUSTOMER, role: 'SELLER' },
        isAuthenticated: true,
      });
      expect(queryByText('Write a Review')).toBeNull();
    });
  });
});
