/**
 * Backend DTO types for catalog APIs.
 * These mirror the backend contracts exactly - do not change field names.
 */

export type CategorySummaryDto = {
  id: string; // UUID
  name: string;
};

export type ProductSummaryDto = {
  id: string; // UUID
  name: string;
  description: string;
  imageUrl: string | null;
  price: string; // decimal string from backend
  stock: number;
  ratingAverage: string; // decimal string from backend
  reviewCount: number;
  active: boolean;
  category: CategorySummaryDto;
  sellerId: string; // UUID
};

export type ProductDetailDto = ProductSummaryDto;

export type PageResponseDto<T> = {
  content: T[];
  page: number; // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * Sorting options accepted by GET /api/v1/products.
 * The backend rejects anything else with a 400, so the union is kept tight.
 */
export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';
