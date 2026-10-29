/**
 * Unit tests for sellerProductService.
 *
 * Verifies exact HTTP methods, endpoint paths, query parameters,
 * request payloads, response unwrapping, and 204 No Content handling.
 */

import { apiClient } from '../../api/client';
import type {
  PageResponseDto,
  ProductCreateRequest,
  ProductDetailDto,
  ProductSummaryDto,
  ProductUpdateRequest,
  SellerProductListFilters,
  StockUpdateRequest,
} from '../../types/sellerProductApi';
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProductById,
  getSellerProducts,
  updateSellerProduct,
  updateSellerProductStock,
} from '../sellerProductService';

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

const mockProductSummary: ProductSummaryDto = {
  id: '33333333-3333-4333-8333-000000000001',
  name: 'iPhone 16 Pro Max',
  description: 'Flagship phone',
  imageUrl: 'https://example.com/phone.png',
  price: '30490000.00',
  stock: 25,
  ratingAverage: '0',
  reviewCount: 0,
  active: true,
  category: {
    id: '22222222-2222-4222-8222-000000000001',
    name: 'Điện thoại',
  },
  sellerId: '11111111-1111-4111-8111-000000000002',
};

const mockPageResponse: PageResponseDto<ProductSummaryDto> = {
  content: [mockProductSummary],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('sellerProductService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSellerProducts', () => {
    it('calls GET /seller/products with default empty params and unwraps data', async () => {
      mockedClient.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: mockPageResponse },
      });

      const result = await getSellerProducts();

      expect(mockedClient.get).toHaveBeenCalledWith('/seller/products', {
        params: {},
      });
      expect(result).toEqual(mockPageResponse);
    });

    it('passes all filter params correctly when provided', async () => {
      mockedClient.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: mockPageResponse },
      });

      const filters: SellerProductListFilters = {
        q: '  phone  ',
        active: true,
        page: 2,
        size: 15,
      };

      const result = await getSellerProducts(filters);

      expect(mockedClient.get).toHaveBeenCalledWith('/seller/products', {
        params: {
          q: 'phone',
          active: true,
          page: 2,
          size: 15,
        },
      });
      expect(result.content).toHaveLength(1);
    });

    it('retains active=false in query params and does not omit it', async () => {
      mockedClient.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            ...mockPageResponse,
            content: [{ ...mockProductSummary, active: false }],
          },
        },
      });

      const filters: SellerProductListFilters = { active: false };

      const result = await getSellerProducts(filters);

      expect(mockedClient.get).toHaveBeenCalledWith('/seller/products', {
        params: { active: false },
      });
      expect(result.content[0].active).toBe(false);
    });

    it('omits blank q parameter', async () => {
      mockedClient.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: mockPageResponse },
      });

      await getSellerProducts({ q: '   ' });

      expect(mockedClient.get).toHaveBeenCalledWith('/seller/products', {
        params: {},
      });
    });
  });

  describe('getSellerProductById', () => {
    it('calls GET /seller/products/{id} and unwraps product detail', async () => {
      mockedClient.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: mockProductSummary },
      });

      const result = await getSellerProductById('product-123');

      expect(mockedClient.get).toHaveBeenCalledWith('/seller/products/product-123');
      expect(result).toEqual(mockProductSummary);
    });
  });

  describe('createSellerProduct', () => {
    it('calls POST /seller/products with creation payload and unwraps response', async () => {
      mockedClient.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true, data: mockProductSummary },
      });

      const payload: ProductCreateRequest = {
        name: 'New Product',
        description: 'New Description',
        imageUrl: 'https://example.com/new.png',
        price: '499000.00',
        stock: 10,
        categoryId: '22222222-2222-4222-8222-000000000001',
        active: true,
      };

      const result = await createSellerProduct(payload);

      expect(mockedClient.post).toHaveBeenCalledWith('/seller/products', payload);
      expect(result).toEqual(mockProductSummary);
    });
  });

  describe('updateSellerProduct', () => {
    it('calls PATCH /seller/products/{id} with partial payload and unwraps response', async () => {
      const updatedProduct: ProductDetailDto = {
        ...mockProductSummary,
        name: 'Updated Name',
        price: '399000.00',
      };

      mockedClient.patch.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: updatedProduct },
      });

      const payload: ProductUpdateRequest = {
        name: 'Updated Name',
        price: '399000.00',
      };

      const result = await updateSellerProduct('product-123', payload);

      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/products/product-123',
        payload,
      );
      expect(result.name).toBe('Updated Name');
      // Verifies stock is not part of the payload
      expect((payload as Record<string, unknown>).stock).toBeUndefined();
    });
  });

  describe('updateSellerProductStock', () => {
    it('calls PATCH /seller/products/{id}/stock with number converted to { stock: number }', async () => {
      const stockUpdated: ProductDetailDto = {
        ...mockProductSummary,
        stock: 50,
      };

      mockedClient.patch.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: stockUpdated },
      });

      const result = await updateSellerProductStock('product-123', 50);

      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/products/product-123/stock',
        { stock: 50 },
      );
      expect(result.stock).toBe(50);
    });

    it('calls PATCH /seller/products/{id}/stock with StockUpdateRequest object', async () => {
      const stockUpdated: ProductDetailDto = {
        ...mockProductSummary,
        stock: 0,
      };

      mockedClient.patch.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: stockUpdated },
      });

      const request: StockUpdateRequest = { stock: 0 };
      const result = await updateSellerProductStock('product-123', request);

      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/seller/products/product-123/stock',
        { stock: 0 },
      );
      expect(result.stock).toBe(0);
    });
  });

  describe('deleteSellerProduct', () => {
    it('calls DELETE /seller/products/{id} and returns void on 204 No Content with empty body', async () => {
      mockedClient.delete.mockResolvedValueOnce({
        status: 204,
        data: null,
      });

      await expect(deleteSellerProduct('product-123')).resolves.toBeUndefined();
      expect(mockedClient.delete).toHaveBeenCalledWith('/seller/products/product-123');
    });

    it('returns void when response data is undefined on 204', async () => {
      mockedClient.delete.mockResolvedValueOnce({
        status: 204,
        data: undefined,
      });

      await expect(deleteSellerProduct('product-123')).resolves.toBeUndefined();
    });

    it('invokes unwrapVoid when response carries ApiResponse structure', async () => {
      mockedClient.delete.mockResolvedValueOnce({
        status: 200,
        data: { success: true, data: null },
      });

      await expect(deleteSellerProduct('product-123')).resolves.toBeUndefined();
      expect(mockedClient.delete).toHaveBeenCalledWith('/seller/products/product-123');
    });
  });
});
