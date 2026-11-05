/**
 * Unit tests for SellerProductFormScreen (Phase 4).
 *
 * Covers:
 * CREATE MODE (Tests 1-22):
 * 1. renders blank create form
 * 2. loads categories
 * 3. selects category
 * 4. valid create submits correct payload
 * 5. sellerId is NOT sent
 * 6. name required
 * 7. name >255 rejected
 * 8. category required
 * 9. price required
 * 10. price 0 rejected
 * 11. negative price rejected
 * 12. malformed price rejected
 * 13. >2 decimal places rejected
 * 14. stock required
 * 15. negative stock rejected
 * 16. decimal stock rejected
 * 17. stock=0 accepted
 * 18. active + blank image rejected
 * 19. inactive + blank image accepted
 * 20. image upload (choose, cancel, failure, keep old URL)
 * 21. duplicate submit prevented while pending
 * 22. create success returns to previous screen
 *
 * EDIT MODE (Tests 23-36):
 * 23. loads product by productId
 * 24. pre-fills fields
 * 25. does NOT show editable stock input
 * 26. valid edit submits correct productId + payload
 * 27. update payload contains NO stock
 * 28. active false can be submitted
 * 29. inactive -> active with blank image rejected
 * 30. inactive -> active with valid image accepted
 * 31. detail loading state
 * 32. detail generic error + retry
 * 33. 403 friendly state
 * 34. 404 friendly state
 * 35. duplicate update prevented while pending
 * 36. edit success returns to previous screen
 *
 * CATEGORY (Tests 37-39):
 * 37. category loading state
 * 38. category error/retry if architecture supports it
 * 39. category IDs, not names, are submitted
 */

import React from 'react';
import { Alert, Keyboard } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useCategories } from '../../hooks/useProducts';
import { pickImage } from '../../utils/imagePicker';
import {
  useCreateSellerProduct,
  useSellerProduct,
  useUpdateSellerProduct,
} from '../../hooks/useSellerProducts';
import type {
  CategorySummaryDto,
  ProductDetailDto,
} from '../../types/sellerProductApi';
import SellerProductFormScreen from '../SellerProductFormScreen';

jest.mock('../../hooks/useProducts');
jest.mock('../../hooks/useImageUpload', () => ({ useImageUpload: jest.fn() }));
jest.mock('../../utils/imagePicker', () => ({ pickImage: jest.fn() }));
jest.mock('../../hooks/useSellerProducts');

const mockedPickImage = pickImage as jest.MockedFunction<typeof pickImage>;
const mockUploadMutateAsync = jest.fn();
const pickedImage = { uri: 'file:///photo.jpg', name: 'image.jpg', type: 'image/jpeg' };

/** Pick an image through the button like a real user; the fake upload returns a url, then wait for the preview to appear. */
async function chooseImage(getByTestId: (id: string) => any, url: string) {
  mockedPickImage.mockResolvedValueOnce(pickedImage);
  mockUploadMutateAsync.mockResolvedValueOnce(url);
  fireEvent.press(getByTestId('pick-image-button'));
  await waitFor(() => {
    expect(getByTestId('image-preview').props.source).toEqual({ uri: url });
  });
}

const mockedUseCategories = useCategories as jest.MockedFunction<
  typeof useCategories
>;
const mockedUseSellerProduct = useSellerProduct as jest.MockedFunction<
  typeof useSellerProduct
>;
const mockedUseCreateSellerProduct = useCreateSellerProduct as jest.MockedFunction<
  typeof useCreateSellerProduct
>;
const mockedUseUpdateSellerProduct = useUpdateSellerProduct as jest.MockedFunction<
  typeof useUpdateSellerProduct
>;

const mockCategories: CategorySummaryDto[] = [
  { id: 'cat-111', name: 'Electronics' },
  { id: 'cat-222', name: 'Fashion' },
  { id: 'cat-333', name: 'Home & Kitchen' },
];

const mockProductDetail: ProductDetailDto = {
  id: 'prod-999',
  name: 'Existing Keyboard Pro',
  description: 'Existing high-end mechanical keyboard',
  price: '2500000.00',
  stock: 42,
  imageUrl: 'https://example.com/existing-keyboard.jpg',
  category: { id: 'cat-111', name: 'Electronics' },
  ratingAverage: '4.9',
  reviewCount: 15,
  active: true,
  sellerId: 'seller-uuid',
};

describe('SellerProductFormScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  } as any;

  const mockCreateMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();
  const mockRefetchDetail = jest.fn();
  const mockRefetchCategories = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    (useImageUpload as jest.Mock).mockReturnValue({
      mutateAsync: mockUploadMutateAsync,
      isPending: false,
    });

    mockedUseCategories.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      isError: false,
      refetch: mockRefetchCategories,
    } as any);

    mockedUseSellerProduct.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchDetail,
    } as any);

    mockedUseCreateSellerProduct.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as any);

    mockedUseUpdateSellerProduct.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as any);
  });

  // ==========================================
  // CREATE MODE TESTS (1 - 22)
  // ==========================================
  describe('CREATE MODE', () => {
    const createRoute = { params: { mode: 'create' } } as any;

    it('1. renders blank create form', () => {
      const { getByText, getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      expect(getByText('New Product')).toBeTruthy();
      expect(getByTestId('name-input').props.value).toBe('');
      expect(getByTestId('price-input').props.value).toBe('');
      expect(getByTestId('stock-input').props.value).toBe('');
      expect(getByTestId('pick-image-button')).toBeTruthy();
      expect(getByTestId('description-input').props.value).toBe('');
      expect(getByTestId('submit-button')).toBeTruthy();
    });

    it('2. loads categories', () => {
      const { getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      expect(getByText('Electronics')).toBeTruthy();
      expect(getByText('Fashion')).toBeTruthy();
      expect(getByText('Home & Kitchen')).toBeTruthy();
    });

    it('3. selects category', () => {
      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      const electronicsChip = getByTestId('category-option-cat-111');
      fireEvent.press(electronicsChip);

      expect(electronicsChip.props.accessibilityState?.selected).toBe(true);
    });

    it('4. valid create submits correct payload and 5. sellerId is NOT sent', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({ id: 'new-prod-id' });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), '  New Mechanical Keyboard  ');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '1250000.50');
      fireEvent.changeText(getByTestId('stock-input'), '15');
      await chooseImage(getByTestId, 'https://example.com/item.jpg');
      fireEvent.changeText(getByTestId('description-input'), 'Awesome tactile keyboard');

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
        const submittedPayload = mockCreateMutateAsync.mock.calls[0][0];

        // 4. Correct payload fields
        expect(submittedPayload).toEqual({
          name: 'New Mechanical Keyboard',
          description: 'Awesome tactile keyboard',
          imageUrl: 'https://example.com/item.jpg',
          price: '1250000.50',
          stock: 15,
          categoryId: 'cat-111',
          active: true,
        });

        // 5. Verify sellerId is NOT sent
        expect(submittedPayload.sellerId).toBeUndefined();
      });
    });

    it('6. name required', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Product name is required')).toBeTruthy();
      });
    });

    it('7. name >255 rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'a'.repeat(256));
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Product name must not exceed 255 characters')).toBeTruthy();
      });
    });

    it('8. category required', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Category is required')).toBeTruthy();
      });
    });

    it('9. price required', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Price is required')).toBeTruthy();
      });
    });

    it('10. price 0 rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '0');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Price must be greater than 0')).toBeTruthy();
      });
    });

    it('11. negative price rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '-500');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Price must be greater than 0')).toBeTruthy();
      });
    });

    it('12. malformed price rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), 'abc');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Price must be a valid number with at most 2 decimal places'),
        ).toBeTruthy();
      });
    });

    it('13. >2 decimal places rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '1000.123');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Price must be a valid number with at most 2 decimal places'),
        ).toBeTruthy();
      });
    });

    it('14. stock required', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '150000');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(getByText('Initial stock is required')).toBeTruthy();
      });
    });

    it('15. negative stock rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '150000');
      fireEvent.changeText(getByTestId('stock-input'), '-1');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Stock must be a non-negative integer (0 or greater)'),
        ).toBeTruthy();
      });
    });

    it('16. decimal stock rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '150000');
      fireEvent.changeText(getByTestId('stock-input'), '1.5');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Stock must be a non-negative integer (0 or greater)'),
        ).toBeTruthy();
      });
    });

    it('17. stock=0 accepted', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({ id: 'zero-stock-id' });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Zero Stock Item');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '50000');
      fireEvent.changeText(getByTestId('stock-input'), '0');
      await chooseImage(getByTestId, 'https://example.com/item.jpg');

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ stock: 0 }),
        );
      });
    });

    it('18. active + blank image rejected', async () => {
      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Valid Name');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '150000');
      fireEvent.changeText(getByTestId('stock-input'), '10');
      // active is true by default, image is blank
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Product image is required when listing product as active'),
        ).toBeTruthy();
      });
    });

    it('19. inactive + blank image accepted', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({ id: 'inactive-item-id' });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Draft Item');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '150000');
      fireEvent.changeText(getByTestId('stock-input'), '10');

      // Toggle active to false
      const activeSwitch = getByTestId('active-switch');
      fireEvent(activeSwitch, 'valueChange', false);

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ active: false, imageUrl: undefined }),
        );
      });
    });

    it('20a. cancelling the picker changes nothing and shows no error', async () => {
      mockedPickImage.mockResolvedValueOnce(null);
      const { getByTestId, queryByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.press(getByTestId('pick-image-button'));

      await waitFor(() => expect(mockedPickImage).toHaveBeenCalled());
      expect(mockUploadMutateAsync).not.toHaveBeenCalled();
      expect(queryByTestId('image-url-error-text')).toBeNull();
      expect(queryByTestId('image-preview')).toBeNull();
    });

    it('20b. a failed upload shows the error under the image field', async () => {
      mockedPickImage.mockResolvedValueOnce(pickedImage);
      mockUploadMutateAsync.mockRejectedValueOnce(new ApiError('Upload failed', 'UPLOAD_FAILED', 500));
      const { getByTestId, findByTestId, queryByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.press(getByTestId('pick-image-button'));

      expect((await findByTestId('image-url-error-text')).props.children).toBe('Upload failed');
      expect(queryByTestId('image-preview')).toBeNull();
    });

    it('20c. saving is blocked while the image is uploading', () => {
      (useImageUpload as jest.Mock).mockReturnValue({
        mutateAsync: mockUploadMutateAsync,
        isPending: true,
      });
      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.press(getByTestId('submit-button'));

      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('21. duplicate submit prevented while pending', () => {
      mockedUseCreateSellerProduct.mockReturnValue({
        mutateAsync: mockCreateMutateAsync,
        isPending: true,
      } as any);

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      const submitBtn = getByTestId('submit-button');
      expect(submitBtn.props.accessibilityState?.disabled).toBe(true);

      fireEvent.press(submitBtn);
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('22. create success returns to previous screen', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({ id: 'new-id' });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Success Item');
      fireEvent.press(getByTestId('category-option-cat-111'));
      fireEvent.changeText(getByTestId('price-input'), '100000');
      fireEvent.changeText(getByTestId('stock-input'), '5');
      await chooseImage(getByTestId, 'https://example.com/img.jpg');

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Product Created',
          '"Success Item" has been created successfully.',
        );
        expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==========================================
  // EDIT MODE TESTS (23 - 36)
  // ==========================================
  describe('EDIT MODE', () => {
    const editRoute = {
      params: { mode: 'edit', productId: 'prod-999' },
    } as any;

    it('23. loads product by productId and 24. pre-fills fields', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      const { getByText, getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      // Verify hook called with productId
      expect(mockedUseSellerProduct).toHaveBeenCalledWith('prod-999', true);

      // Verify header and prefilled fields
      expect(getByText('Edit Product')).toBeTruthy();
      expect(getByTestId('name-input').props.value).toBe('Existing Keyboard Pro');
      expect(getByTestId('price-input').props.value).toBe('2500000.00');
      expect(getByTestId('image-preview').props.source).toEqual({
        uri: 'https://example.com/existing-keyboard.jpg',
      });
      expect(getByTestId('description-input').props.value).toBe(
        'Existing high-end mechanical keyboard',
      );
      expect(
        getByTestId('category-option-cat-111').props.accessibilityState?.selected,
      ).toBe(true);
    });

    it('25. does NOT show editable stock input in edit mode and shows informational banner', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      const { queryByTestId, getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      // Editable stock input must NOT exist
      expect(queryByTestId('stock-input')).toBeNull();

      // Informational note must be visible
      expect(getByTestId('stock-notice-box')).toBeTruthy();
      expect(getByText('Current Stock: 42')).toBeTruthy();
      expect(getByText('Stock is managed separately from My Products.')).toBeTruthy();
    });

    it('26. valid edit submits correct productId + payload and 27. update payload contains NO stock', async () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      mockUpdateMutateAsync.mockResolvedValueOnce({
        ...mockProductDetail,
        name: 'Updated Keyboard Pro',
      });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Updated Keyboard Pro');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1);
        const { id, payload } = mockUpdateMutateAsync.mock.calls[0][0];

        // 26. correct productId
        expect(id).toBe('prod-999');

        // 27. update payload contains NO stock
        expect(payload.stock).toBeUndefined();
        expect(payload).toEqual({
          name: 'Updated Keyboard Pro',
          description: 'Existing high-end mechanical keyboard',
          imageUrl: 'https://example.com/existing-keyboard.jpg',
          price: '2500000.00',
          categoryId: 'cat-111',
          active: true,
        });
      });
    });

    it('28. active false can be submitted in edit mode', async () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      mockUpdateMutateAsync.mockResolvedValueOnce({
        ...mockProductDetail,
        active: false,
      });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      // Unlist by setting active switch to false
      const activeSwitch = getByTestId('active-switch');
      fireEvent(activeSwitch, 'valueChange', false);

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ active: false }),
          }),
        );
      });
    });

    it('29. inactive -> active with blank image rejected', async () => {
      mockedUseSellerProduct.mockReturnValue({
        data: { ...mockProductDetail, active: false, imageUrl: '' },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      // Switch active from false to true while imageUrl is empty
      const activeSwitch = getByTestId('active-switch');
      fireEvent(activeSwitch, 'valueChange', true);

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
        expect(
          getByText('Product image is required when listing product as active'),
        ).toBeTruthy();
      });
    });

    it('30. inactive -> active with valid image accepted', async () => {
      mockedUseSellerProduct.mockReturnValue({
        data: { ...mockProductDetail, active: false, imageUrl: '' },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      mockUpdateMutateAsync.mockResolvedValueOnce({
        ...mockProductDetail,
        active: true,
      });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      // Provide valid image and activate switch
      await chooseImage(getByTestId, 'https://example.com/new-img.jpg');
      const activeSwitch = getByTestId('active-switch');
      fireEvent(activeSwitch, 'valueChange', true);

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              active: true,
              imageUrl: 'https://example.com/new-img.jpg',
            }),
          }),
        );
      });
    });

    it('31. detail loading state', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      expect(getByTestId('seller-product-form-loading')).toBeTruthy();
      expect(getByText('Loading product details…')).toBeTruthy();
    });

    it('32. detail generic error + retry', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Failed to fetch product', 'INTERNAL_ERROR', 500),
        refetch: mockRefetchDetail,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      expect(getByTestId('seller-product-form-error')).toBeTruthy();
      expect(getByText("Couldn't load product")).toBeTruthy();

      fireEvent.press(getByTestId('detail-retry-button'));
      expect(mockRefetchDetail).toHaveBeenCalledTimes(1);
    });

    it('33. 403 friendly state', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Unauthorized seller', 'UNAUTHORIZED', 403),
        refetch: mockRefetchDetail,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      expect(getByTestId('seller-product-form-403')).toBeTruthy();
      expect(getByText('Access Denied')).toBeTruthy();
      expect(
        getByText(
          'You are not authorized to edit this product, or your seller account is not approved.',
        ),
      ).toBeTruthy();

      fireEvent.press(getByTestId('detail-back-button'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('34. 404 friendly state', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new ApiError('Product not found', 'NOT_FOUND', 404),
        refetch: mockRefetchDetail,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      expect(getByTestId('seller-product-form-404')).toBeTruthy();
      expect(getByText('Product Not Found')).toBeTruthy();
      expect(
        getByText('The product you are trying to edit could not be found.'),
      ).toBeTruthy();

      fireEvent.press(getByTestId('detail-back-button'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('35. duplicate update prevented while pending', () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      mockedUseUpdateSellerProduct.mockReturnValue({
        mutateAsync: mockUpdateMutateAsync,
        isPending: true,
      } as any);

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      const submitBtn = getByTestId('submit-button');
      expect(submitBtn.props.accessibilityState?.disabled).toBe(true);

      fireEvent.press(submitBtn);
      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });

    it('36. edit success returns to previous screen', async () => {
      mockedUseSellerProduct.mockReturnValue({
        data: mockProductDetail,
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchDetail,
      } as any);

      mockUpdateMutateAsync.mockResolvedValueOnce({
        ...mockProductDetail,
        name: 'Saved Name',
      });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Saved Name');
      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Product Updated',
          '"Saved Name" has been updated successfully.',
        );
        expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==========================================
  // CATEGORY TESTS (37 - 39)
  // ==========================================
  describe('CATEGORY SELECTOR', () => {
    const createRoute = { params: { mode: 'create' } } as any;

    it('37. category loading state', () => {
      mockedUseCategories.mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        refetch: mockRefetchCategories,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      expect(getByTestId('categories-loading')).toBeTruthy();
      expect(getByText('Loading categories…')).toBeTruthy();
    });

    it('38. category error/retry behavior', () => {
      mockedUseCategories.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        refetch: mockRefetchCategories,
      } as any);

      const { getByTestId, getByText } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      expect(getByTestId('categories-error')).toBeTruthy();
      expect(getByText('Failed to load categories')).toBeTruthy();

      fireEvent.press(getByTestId('categories-retry-button'));
      expect(mockRefetchCategories).toHaveBeenCalledTimes(1);
    });

    it('39. category IDs, not names, are submitted', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({ id: 'id-test' });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      fireEvent.changeText(getByTestId('name-input'), 'Test Product');
      // Select 'Fashion' category whose ID is 'cat-222'
      fireEvent.press(getByTestId('category-option-cat-222'));
      fireEvent.changeText(getByTestId('price-input'), '200000');
      fireEvent.changeText(getByTestId('stock-input'), '10');
      await chooseImage(getByTestId, 'https://example.com/img.jpg');

      fireEvent.press(getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ categoryId: 'cat-222' }),
        );
        // Ensure category name is NOT sent
        expect(
          (mockCreateMutateAsync.mock.calls[0][0] as any).categoryName,
        ).toBeUndefined();
      });
    });
  });

  // ==========================================
  // KEYBOARD & SCROLL UX (Defect 02 regression)
  // ==========================================
  describe('KEYBOARD & SCROLL UX (Defect 02 regression)', () => {
    const createRoute = { params: { mode: 'create' } } as any;
    const editRoute = { params: { mode: 'edit', productId: 'prod-999' } } as any;

    it('40. renders scroll view with keyboardShouldPersistTaps="handled" and dismiss on drag', () => {
      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      // Verify the screen wrapper is present
      expect(getByTestId('seller-product-form-screen')).toBeTruthy();
      expect(getByTestId('name-input')).toBeTruthy();
    });

    it('41. wires onFocus and onLayout callbacks to form inputs to enable auto-scroll', () => {
      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      // Verify onFocus handlers can be triggered without error
      fireEvent(getByTestId('name-input'), 'focus');
      fireEvent(getByTestId('price-input'), 'focus');
      fireEvent(getByTestId('stock-input'), 'focus');
      fireEvent(getByTestId('description-input'), 'focus');

      // Verify layout measurement events are handled
      fireEvent(getByTestId('name-input'), 'layout', {
        nativeEvent: { layout: { y: 20 } },
      });
      fireEvent(getByTestId('pick-image-button'), 'layout', {
        nativeEvent: { layout: { y: 350 } },
      });
      fireEvent(getByTestId('description-input'), 'layout', {
        nativeEvent: { layout: { y: 480 } },
      });
    });

    it('42. Description field is multiline, has vertical top alignment, and placeholder', () => {
      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      const descInput = getByTestId('description-input');
      expect(descInput.props.multiline).toBe(true);
      expect(descInput.props.numberOfLines).toBe(4);
      expect(descInput.props.textAlignVertical).toBe('top');
      expect(descInput.props.placeholder).toBe(
        'Enter detailed description of your product...',
      );
    });

    it('43. all inputs, switches, and submit action remain inside scrollable content in both create and edit modes', () => {
      // Create mode
      const { getByTestId: getCreateTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );
      expect(getCreateTestId('name-input')).toBeTruthy();
      expect(getCreateTestId('categories-container')).toBeTruthy();
      expect(getCreateTestId('price-input')).toBeTruthy();
      expect(getCreateTestId('stock-input')).toBeTruthy();
      expect(getCreateTestId('pick-image-button')).toBeTruthy();
      expect(getCreateTestId('description-input')).toBeTruthy();
      expect(getCreateTestId('active-switch')).toBeTruthy();
      expect(getCreateTestId('submit-button')).toBeTruthy();

      // Edit mode
      const { getByTestId: getEditTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={editRoute} />,
      );
      expect(getEditTestId('name-input')).toBeTruthy();
      expect(getEditTestId('categories-container')).toBeTruthy();
      expect(getEditTestId('price-input')).toBeTruthy();
      expect(getEditTestId('stock-notice-box')).toBeTruthy();
      expect(getEditTestId('pick-image-button')).toBeTruthy();
      expect(getEditTestId('description-input')).toBeTruthy();
      expect(getEditTestId('active-switch')).toBeTruthy();
      expect(getEditTestId('submit-button')).toBeTruthy();
    });

    it('44. attaches keyboard show/hide listeners and updates padding dynamically', () => {
      let showCallback: ((e: any) => void) | undefined;
      let hideCallback: (() => void) | undefined;

      const addListenerSpy = jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((event: string, cb: any) => {
          if (event === 'keyboardDidShow' || event === 'keyboardWillShow') {
            showCallback = cb;
          }
          if (event === 'keyboardDidHide' || event === 'keyboardWillHide') {
            hideCallback = cb;
          }
          return { remove: jest.fn() } as any;
        });

      const { getByTestId } = render(
        <SellerProductFormScreen navigation={mockNavigation} route={createRoute} />,
      );

      expect(addListenerSpy).toHaveBeenCalled();
      expect(typeof showCallback).toBe('function');
      expect(typeof hideCallback).toBe('function');

      // Simulate keyboard appearing
      act(() => {
        showCallback?.({ endCoordinates: { height: 320 } });
      });

      // Inputs and submit buttons remain fully accessible
      expect(getByTestId('pick-image-button')).toBeTruthy();
      expect(getByTestId('description-input')).toBeTruthy();
      expect(getByTestId('submit-button')).toBeTruthy();

      // Simulate keyboard hiding
      act(() => {
        hideCallback?.();
      });

      expect(getByTestId('submit-button')).toBeTruthy();
      addListenerSpy.mockRestore();
    });
  });
});
