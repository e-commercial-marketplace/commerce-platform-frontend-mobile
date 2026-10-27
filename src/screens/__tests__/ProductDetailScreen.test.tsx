/**
 * Buy Now handoff tests.
 *
 * The screen's data/cart hooks are mocked so the test focuses on the flow:
 * add the selected quantity through the real cart mutation contract, find the
 * resulting cart line by productId (never by array position), then navigate to
 * Checkout with that cart-item id.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { User } from '../../types/auth';
import type { Cart } from '../../types/cart';
import type { Product } from '../../types/product';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useProductDetail } from '../../hooks/useProducts';
import { useSellerShop } from '../../hooks/useSellers';
import ProductDetailScreen from '../ProductDetailScreen';

jest.mock('../../hooks/useAuth', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useCart', () => ({ useCart: jest.fn() }));
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
  addItem: jest.Mock,
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
  mockedUseSellerShop.mockReturnValue({ data: undefined } as never);

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

describe('ProductDetailScreen Buy Now', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  describe('Reviews Integration', () => {
    it('renders customer reviews section with aggregate summary', () => {
      const { getByText } = renderScreen(jest.fn());
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
      const { getByText, getByPlaceholderText } = renderScreen(jest.fn());
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
