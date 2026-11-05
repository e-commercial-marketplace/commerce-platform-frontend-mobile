/**
 * Backend DTO and request types for Seller Product Management.
 *
 * Direct mapping to backend entities and endpoints under /api/v1/seller/products:
 * - GET /seller/products
 * - GET /seller/products/{id}
 * - POST /seller/products
 * - PATCH /seller/products/{id}
 * - PATCH /seller/products/{id}/stock
 * - DELETE /seller/products/{id}
 */

import type {
  CategorySummaryDto,
  PageResponseDto,
  ProductDetailDto,
  ProductSummaryDto,
} from './productApi';

// Re-export shared catalog types for convenience
export type {
  CategorySummaryDto,
  PageResponseDto,
  ProductDetailDto,
  ProductSummaryDto,
};

/**
 * Filter and pagination parameters for GET /api/v1/seller/products.
 * Sourced from SellerProductController.list(...).
 */
export type SellerProductListFilters = {
  /** Text search against product name and description (`q`). */
  q?: string;
  /** Filter by visibility: true (listed), false (unlisted), or undefined (both). */
  active?: boolean;
  /** Zero-based page index. */
  page?: number;
  /** Page size (backend default 20, max 100). */
  size?: number;
};

/**
 * Request body for POST /api/v1/seller/products.
 * Maps to backend ProductCreateRequest.java.
 *
 * Invariants:
 * - name: not blank, max 255 chars
 * - price: strictly > 0, max 2 decimal places
 * - stock: integer >= 0
 * - categoryId: UUID string of an existing category
 * - active: optional boolean (defaults to true)
 * - imageUrl: required if active is true (or omitted)
 */
export type ProductCreateRequest = {
  name: string;
  description?: string;
  imageUrl?: string;
  price: string | number;
  stock: number;
  categoryId: string;
  active?: boolean;
};

/**
 * Request body for PATCH /api/v1/seller/products/{id}.
 * Maps to backend ProductUpdateRequest.java.
 *
 * All fields are optional (partial update).
 * CRITICAL: The backend does NOT accept `stock` here. Stock updates must go
 * through the dedicated stock endpoint (PATCH /seller/products/{id}/stock).
 */
export type ProductUpdateRequest = {
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: string | number;
  categoryId?: string;
  active?: boolean;
};

/**
 * Request body for PATCH /api/v1/seller/products/{id}/stock.
 * Maps to backend StockUpdateRequest.java.
 *
 * Sets the new absolute inventory level.
 * Invariant: stock integer >= 0.
 */
export type StockUpdateRequest = {
  stock: number;
};
