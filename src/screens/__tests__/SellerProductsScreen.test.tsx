/**
 * Unit tests for SellerProductsScreen (Phase 3).
 *
 * Covers:
 * A. Rendering:
 *    - loading state
 *    - successful product list
 *    - product information rendered
 *    - empty seller state (+ add product CTA)
 *    - empty filtered/search state (+ clear filters CTA)
 *    - generic API error + retry
 *    - 403 seller approval blocked state + retry & go back
 *    - unauthenticated / non-seller access required guard
 *
 * B. Search & Debounce:
 *    - search input changes immediately
 *    - debounced query reaches hook after delay
 *    - changing search query resets page to 0
 *
 * C. Status Filters:
 *    - ALL -> active undefined
 *    - LISTED -> active true
 *    - UNLISTED -> active false (explicit boolean preserved)
 *    - changing filter resets page to 0
 *
 * D. Pagination:
 *    - initial page 0
 *    - Next moves to next page
 *    - Previous moves back
 *    - Previous disabled on page 0
 *    - Next disabled on last page
 *
 * E. Navigation:
 *    - Header "+ Add Product" -> SellerProductForm { mode: 'create' }
 *    - Card "Edit" -> SellerProductForm { mode: 'edit', productId }
 *
 * F. Stock Update:
 *    - opens UpdateProductStockModal
 *    - submits absolute stock to useUpdateSellerProductStock
 *    - shows success feedback
 *
 * G. Unlist:
 *    - active product prompts confirmation alert
 *    - confirmation invokes useDeleteSellerProduct
 *    - cancellation does NOT invoke delete mutation
 *
 * H. Relist:
 *    - inactive product with valid image invokes update mutation: { active: true }
 *    - inactive product without image does NOT invoke update mutation and directs to edit
 *
 * I. Pull-to-refresh:
 *    - invokes refetch on query
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { useAuth } from '../../hooks/useAuth';
import {
  useDeleteSellerProduct,
  useSellerProducts,
  useUpdateSellerProduct,
  useUpdateSellerProductStock,
} from '../../hooks/useSellerProducts';
import type {
  PageResponseDto,
  ProductSummaryDto,
} from '../../types/sellerProductApi';
import SellerProductsScreen from '../SellerProductsScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useSellerProducts');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseSellerProducts = useSellerProducts as jest.MockedFunction<
  typeof useSellerProducts
>;
const mockedUseUpdateSellerProduct = useUpdateSellerProduct as jest.MockedFunction<
  typeof useUpdateSellerProduct
>;
const mockedUseUpdateSellerProductStock = useUpdateSellerProductStock as jest.MockedFunction<
  typeof useUpdateSellerProductStock
>;
const mockedUseDeleteSellerProduct = useDeleteSellerProduct as jest.MockedFunction<
  typeof useDeleteSellerProduct
>;

const mockActiveProduct: ProductSummaryDto = {
  id: 'prod-1',
  name: 'Active Mechanical Keyboard',
  description: 'A great mechanical keyboard',
  price: '1500000.00',
  stock: 12,
  imageUrl: 'https://example.com/keyboard.jpg',
  category: { id: 'cat-1', name: 'Electronics' },
  ratingAverage: '4.8',
  reviewCount: 10,
  active: true,
  sellerId: 'seller-1',
};

const mockInactiveProductWithImage: ProductSummaryDto = {
  id: 'prod-2',
  name: 'Inactive Wireless Mouse',
  description: 'Ergonomic wireless mouse',
  price: '650000.00',
  stock: 0,
  imageUrl: 'https://example.com/mouse.jpg',
  category: { id: 'cat-1', name: 'Electronics' },
  ratingAverage: '4.5',
  reviewCount: 3,
  active: false,
  sellerId: 'seller-1',
};

const mockInactiveProductNoImage: ProductSummaryDto = {
  id: 'prod-3',
  name: 'Inactive Desk Mat No Image',
  description: 'Desk mat without image',
  price: '200000.00',
  stock: 5,
  imageUrl: '',
  category: { id: 'cat-2', name: 'Accessories' },
  ratingAverage: '0',
  reviewCount: 0,
  active: false,
  sellerId: 'seller-1',
};

function createPageResponse(
  content: ProductSummaryDto[],
  page = 0,
  totalPages = 1,
  totalElements = content.length,
): PageResponseDto<ProductSummaryDto> {
  return {
    content,
    page,
    size: 20,
    totalElements,
    totalPages,
  };
}

describe('SellerProductsScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  } as any;

  const mockRefetch = jest.fn();
  const mockMutateUpdate = jest.fn();
  const mockMutateStock = jest.fn();
  const mockMutateDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseAuth.mockReturnValue({
      user: { id: 'seller-1', email: 'seller@example.com', role: 'SELLER' },
      isAuthenticated: true,
      isRestoring: false,
    } as any);

    mockedUseUpdateSellerProduct.mockReturnValue({
      mutateAsync: mockMutateUpdate,
      isPending: false,
    } as any);

    mockedUseUpdateSellerProductStock.mockReturnValue({
      mutateAsync: mockMutateStock,
      isPending: false,
    } as any);

    mockedUseDeleteSellerProduct.mockReturnValue({
      mutateAsync: mockMutateDelete,
      isPending: false,
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==========================================
  // A. RENDERING & STATE TESTS
  // ==========================================
  describe('Rendering & State', () => {
    it('renders loading indicator while query is loading', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-products-loading')).toBeTruthy();
      expect(getByText('Loading products…')).toBeTruthy();
    });

    it('renders product items and header information when query succeeds', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct, mockInactiveProductWithImage]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText, getByTestId } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByText('My Products')).toBeTruthy();
      expect(getByText('(2)')).toBeTruthy();
      expect(getByTestId(`seller-product-card-${mockActiveProduct.id}`)).toBeTruthy();
      expect(getByTestId(`seller-product-card-${mockInactiveProductWithImage.id}`)).toBeTruthy();
      expect(getByText('Active Mechanical Keyboard')).toBeTruthy();
      expect(getByText('Inactive Wireless Mouse')).toBeTruthy();
    });

    it('renders initial empty state when seller has no products', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-products-empty-initial')).toBeTruthy();
      expect(getByText('No products yet')).toBeTruthy();
      expect(getByText("You haven't added any products to your shop.")).toBeTruthy();

      const createBtn = getByTestId('empty-create-button');
      fireEvent.press(createBtn);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SellerProductForm', {
        mode: 'create',
      });
    });

    it('renders filtered empty state when search/filter yields no products', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      // Select 'Listed' chip
      fireEvent.press(getByText('Listed'));

      expect(getByTestId('seller-products-empty-filtered')).toBeTruthy();
      expect(getByText('No matching products')).toBeTruthy();
      expect(getByText('No products matched your search or filter criteria.')).toBeTruthy();

      // Clear filters button
      const clearBtn = getByTestId('clear-filters-button');
      fireEvent.press(clearBtn);

      // Clears filters and resets to undefined status
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: undefined, q: undefined, page: 0 }),
        true,
      );
    });

    it('renders generic error state and retries on press', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: new ApiError('Network connection lost', 'NETWORK_ERROR', null),
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-products-error-state')).toBeTruthy();
      expect(getByText("Couldn't load products")).toBeTruthy();
      expect(getByText('Network connection lost')).toBeTruthy();

      const retryBtn = getByTestId('retry-button');
      fireEvent.press(retryBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders dedicated 403 seller approval blocked state without crashing', () => {
      const forbiddenError = new ApiError(
        'Seller is not approved',
        'SELLER_NOT_APPROVED',
        403,
      );

      mockedUseSellerProducts.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: forbiddenError,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-approval-blocked-state')).toBeTruthy();
      expect(getByText('Account Not Approved')).toBeTruthy();
      expect(
        getByText('Your seller account is not currently approved to manage products.'),
      ).toBeTruthy();

      // Retry
      const retryBtn = getByTestId('approval-retry-button');
      fireEvent.press(retryBtn);
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      // Go back
      const backBtn = getByTestId('approval-back-button');
      fireEvent.press(backBtn);
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('renders access required guard for non-seller or unauthenticated user', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', email: 'cust@example.com', role: 'CUSTOMER' },
        isAuthenticated: true,
        isRestoring: false,
      } as any);

      mockedUseSellerProducts.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-access-required-state')).toBeTruthy();
      expect(getByText('Seller Access Required')).toBeTruthy();
    });
  });

  // ==========================================
  // B. SEARCH & DEBOUNCE TESTS
  // ==========================================
  describe('Search & Debounce', () => {
    it('updates text input immediately and applies debounced q after timer delay', () => {
      jest.useFakeTimers();

      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByPlaceholderText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const searchInput = getByPlaceholderText('Search my products...');

      // Initial call has q: undefined
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: undefined, page: 0 }),
        true,
      );

      // Typing in input updates immediately
      act(() => {
        fireEvent.changeText(searchInput, 'Mechanical');
      });

      // Before timer advances, hook has not received debounced q: 'Mechanical'
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: undefined }),
        true,
      );

      // Advance timer by 400ms
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Hook receives debounced query and resets page to 0
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Mechanical', page: 0 }),
        true,
      );
    });

    it('keeps search TextInput mounted and preserves typed value during background query fetching (Defect 01 regression)', () => {
      jest.useFakeTimers();

      // Step 1: Initial load succeeds with products
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByPlaceholderText, queryByTestId, rerender } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const searchInput = getByPlaceholderText('Search my products...');
      expect(searchInput).toBeTruthy();
      expect(searchInput.props.editable).not.toBe(false);

      // Step 2: User types 'AirPods'
      act(() => {
        fireEvent.changeText(searchInput, 'AirPods');
      });

      expect(searchInput.props.value).toBe('AirPods');

      // Step 3: Advance debounce timer (400ms)
      act(() => {
        jest.advanceTimersByTime(400);
      });

      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'AirPods', page: 0 }),
        true,
      );

      // Step 4: Simulate background query execution (isFetching = true, previous data retained)
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      rerender(<SellerProductsScreen navigation={mockNavigation} route={{} as any} />);

      // Search input MUST remain mounted in the tree and retain typed text
      const searchInputAfterFetch = getByPlaceholderText('Search my products...');
      expect(searchInputAfterFetch).toBeTruthy();
      expect(searchInputAfterFetch.props.value).toBe('AirPods');
      expect(searchInputAfterFetch.props.editable).not.toBe(false);

      // Background fetching indicator MUST be visible without full screen replacement
      expect(queryByTestId('seller-products-fetching-indicator')).toBeTruthy();
      expect(queryByTestId('seller-products-loading')).toBeNull();

      act(() => {
        jest.runOnlyPendingTimers();
      });
    });

    it('background isFetching does NOT replace the entire screen with initial loading UI (Defect 01 regression)', () => {
      // Step 1: Render with initial data
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, queryByTestId, rerender } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByTestId('seller-products-screen')).toBeTruthy();
      expect(getByTestId('seller-products-list')).toBeTruthy();

      // Step 2: Transition to background fetch
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      rerender(<SellerProductsScreen navigation={mockNavigation} route={{} as any} />);

      // Entire screen and list remain mounted; full-screen loading spinner is NEVER shown
      expect(queryByTestId('seller-products-loading')).toBeNull();
      expect(getByTestId('seller-products-screen')).toBeTruthy();
      expect(getByTestId('seller-products-list')).toBeTruthy();
      expect(getByTestId('seller-products-fetching-indicator')).toBeTruthy();
    });

    it('typing continuously across multiple keystrokes preserves input state and resets page to 0', () => {
      jest.useFakeTimers();

      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByPlaceholderText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const searchInput = getByPlaceholderText('Search my products...');

      // Keystroke 1: 'A'
      act(() => {
        fireEvent.changeText(searchInput, 'A');
      });
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(searchInput.props.value).toBe('A');
      expect(searchInput.props.editable).not.toBe(false);

      // Keystroke 2: 'Ai'
      act(() => {
        fireEvent.changeText(searchInput, 'Ai');
      });
      act(() => {
        jest.advanceTimersByTime(100);
      });
      expect(searchInput.props.value).toBe('Ai');
      expect(searchInput.props.editable).not.toBe(false);

      // Keystroke 3: 'AirPods'
      act(() => {
        fireEvent.changeText(searchInput, 'AirPods');
      });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(searchInput.props.value).toBe('AirPods');
      expect(searchInput.props.editable).not.toBe(false);

      // Final debounced call to query hook
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'AirPods', page: 0 }),
        true,
      );

      act(() => {
        jest.runOnlyPendingTimers();
      });
    });
  });

  // ==========================================
  // C. STATUS FILTER TESTS
  // ==========================================
  describe('Status Filters', () => {
    it('correctly maps ALL -> undefined, LISTED -> true, UNLISTED -> false (preserving false)', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct, mockInactiveProductWithImage]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByLabelText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      // 1. Listed chip -> active: true
      fireEvent.press(getByLabelText('Filter by listed products'));
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: true, page: 0 }),
        true,
      );

      // 2. Unlisted chip -> active: false (explicit boolean)
      fireEvent.press(getByLabelText('Filter by unlisted products'));
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: false, page: 0 }),
        true,
      );

      // 3. All chip -> active: undefined
      fireEvent.press(getByLabelText('Filter by all products'));
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: undefined, page: 0 }),
        true,
      );
    });
  });

  // ==========================================
  // D. PAGINATION TESTS
  // ==========================================
  describe('Pagination', () => {
    it('manages page transitions and disables buttons at boundaries', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct], 0, 3, 45),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      expect(getByText('Page 1 of 3')).toBeTruthy();

      const prevBtn = getByTestId('pagination-prev');
      const nextBtn = getByTestId('pagination-next');

      // Previous button should be disabled on page 0
      expect(prevBtn.props.accessibilityState?.disabled).toBe(true);
      expect(nextBtn.props.accessibilityState?.disabled).toBeFalsy();

      // Press Next -> page moves to 1
      fireEvent.press(nextBtn);
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
        true,
      );

      // Re-query previous button after re-render and press it
      const updatedPrevBtn = getByTestId('pagination-prev');
      expect(updatedPrevBtn.props.accessibilityState?.disabled).toBeFalsy();

      fireEvent.press(updatedPrevBtn);
      expect(mockedUseSellerProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0 }),
        true,
      );
    });
  });

  // ==========================================
  // E. NAVIGATION TESTS
  // ==========================================
  describe('Navigation', () => {
    it('navigates to SellerProductForm with create mode from top header button', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const createBtn = getByTestId('create-product-button');
      fireEvent.press(createBtn);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('SellerProductForm', {
        mode: 'create',
      });
    });

    it('navigates to SellerProductForm with edit mode and productId from card Edit button', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const editBtn = getByText('Edit');
      fireEvent.press(editBtn);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('SellerProductForm', {
        mode: 'edit',
        productId: mockActiveProduct.id,
      });
    });
  });

  // ==========================================
  // F. STOCK UPDATE TESTS
  // ==========================================
  describe('Stock Update', () => {
    it('opens UpdateProductStockModal, submits absolute stock to mutation, and handles success', async () => {
      mockMutateStock.mockResolvedValueOnce({ ...mockActiveProduct, stock: 25 });

      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText, getByTestId } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      // Open Stock modal
      const stockBtn = getByText('Update Stock');
      fireEvent.press(stockBtn);

      expect(getByTestId('update-product-stock-modal')).toBeTruthy();
      const modalCard = getByTestId('update-stock-modal-card');
      expect(within(modalCard).getByText('Active Mechanical Keyboard')).toBeTruthy();

      // Enter new absolute stock
      const stockInput = getByTestId('update-stock-input');
      fireEvent.changeText(stockInput, '25');

      // Save
      const saveBtn = getByText('Save');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockMutateStock).toHaveBeenCalledWith({
          id: mockActiveProduct.id,
          stock: 25,
        });
        expect(Alert.alert).toHaveBeenCalledWith(
          'Stock Updated',
          'Stock for "Active Mechanical Keyboard" updated to 25.',
        );
      });
    });
  });

  // ==========================================
  // G. UNLIST TESTS
  // ==========================================
  describe('Unlist Flow', () => {
    it('prompts confirmation on Unlist, cancels without mutating if Cancel is pressed', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const unlistBtn = getByText('Unlist');
      fireEvent.press(unlistBtn);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Unlist Product',
        expect.stringContaining('Are you sure you want to unlist "Active Mechanical Keyboard"?'),
        expect.any(Array),
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelOption = alertButtons.find((b: any) => b.text === 'Cancel');
      cancelOption?.onPress?.();

      expect(mockMutateDelete).not.toHaveBeenCalled();
    });

    it('invokes useDeleteSellerProduct when Unlist confirmation is accepted', async () => {
      mockMutateDelete.mockResolvedValueOnce(undefined);

      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const unlistBtn = getByText('Unlist');
      fireEvent.press(unlistBtn);

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const unlistConfirmOption = alertButtons.find((b: any) => b.text === 'Unlist');

      await act(async () => {
        await unlistConfirmOption?.onPress?.();
      });

      expect(mockMutateDelete).toHaveBeenCalledWith(mockActiveProduct.id);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Product Unlisted',
        '"Active Mechanical Keyboard" has been unlisted.',
      );
    });
  });

  // ==========================================
  // H. RELIST TESTS
  // ==========================================
  describe('Relist Flow', () => {
    it('invokes useUpdateSellerProduct with active: true for inactive product with valid image', async () => {
      mockMutateUpdate.mockResolvedValueOnce({
        ...mockInactiveProductWithImage,
        active: true,
      });

      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockInactiveProductWithImage]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const relistBtn = getByText('Relist');

      await act(async () => {
        fireEvent.press(relistBtn);
      });

      expect(mockMutateUpdate).toHaveBeenCalledWith({
        id: mockInactiveProductWithImage.id,
        payload: { active: true },
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Product Relisted',
        '"Inactive Wireless Mouse" has been relisted.',
      );
    });

    it('does NOT invoke mutation and prompts to edit product if inactive product has no image', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockInactiveProductNoImage]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const relistBtn = getByText('Relist');
      fireEvent.press(relistBtn);

      expect(mockMutateUpdate).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'Image Required',
        'An image is required before relisting this product. Please edit the product and provide an image.',
        expect.any(Array),
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const editOption = alertButtons.find((b: any) => b.text === 'Edit Product');
      editOption?.onPress?.();

      expect(mockNavigation.navigate).toHaveBeenCalledWith('SellerProductForm', {
        mode: 'edit',
        productId: mockInactiveProductNoImage.id,
      });
    });
  });

  // ==========================================
  // I. REFRESH TESTS
  // ==========================================
  describe('Pull to Refresh', () => {
    it('invokes refetch when pull-to-refresh is triggered', () => {
      mockedUseSellerProducts.mockReturnValue({
        data: createPageResponse([mockActiveProduct]),
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId } = render(
        <SellerProductsScreen navigation={mockNavigation} route={{} as any} />,
      );

      const flatList = getByTestId('seller-products-list');
      const { refreshControl } = flatList.props;

      act(() => {
        refreshControl.props.onRefresh();
      });

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });
});
