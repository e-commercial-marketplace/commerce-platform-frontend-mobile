/**
 * Backend DTO types for product reviews & ratings API.
 *
 * Verified against the backend source:
 * - POST /api/v1/products/{productId}/reviews -> 201 ApiResponse<ReviewResponse>
 * - GET  /api/v1/products/{productId}/reviews -> 200 ApiResponse<PageResponse<ReviewResponse>>
 */

/** Paginated response wrapper returned by backend PageResponse.java. */
export type PageResponse<T> = {
  content: T[];
  page: number; // 0-based
  size: number;
  totalElements: number;
  totalPages: number;
  first?: boolean;
  last?: boolean;
};

/** Request body for POST /api/v1/products/{productId}/reviews. */
export type ReviewCreateRequest = {
  /** Rating integer from 1 to 5 inclusive. */
  rating: number;
  /** Non-blank feedback comment, maximum 2000 characters. */
  comment: string;
};

/** Single product review returned by the backend. */
export type ReviewResponse = {
  /** Review unique identifier (UUID). */
  id: string;
  /** Product unique identifier (UUID). */
  productId: string;
  /** Customer unique identifier (UUID). Note: PII is omitted by design. */
  userId: string;
  /** Rating integer from 1 to 5. */
  rating: number;
  /** Reviewer comment text. */
  comment: string;
  /** Creation timestamp in ISO-8601 UTC string format. */
  createdAt: string;
};
