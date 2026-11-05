/**
 * Central query-key factory for every server-owned resource.
 *
 * Conventions follow the frontend README ("Planned Query Conventions"):
 * keys are arrays whose first element is the resource name (`all`), so a
 * feature can invalidate at any granularity:
 *
 *   queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
 *   queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
 *
 * Keys are built here instead of inline in features so invalidation cannot
 * drift out of sync with the keys a query registered. Only resources that the
 * milestone depends on are declared; entries for resources whose backend API
 * does not exist yet (orders, reviews, shipments) are declared as conventions
 * only and are NOT used to fetch anything.
 *
 * Note: this file intentionally declares no queries — it only names keys.
 */

import type {
  SellerOrderItemFilterParams,
  SellerShipmentFilterParams,
} from '../types/sellerApi';
import type { SellerProductListFilters } from '../types/sellerProductApi';

export type { SellerProductListFilters };

/** Public catalog list filters, mirroring GET /api/v1/products query params. */
export type ProductListFilters = {
  /** Text search term (`q`). */
  q?: string;
  /** Category UUID (`categoryId`). */
  categoryId?: string;
  /** Seller UUID (`sellerId`) for the shop page. */
  sellerId?: string;
  /** Inclusive lower price bound (`minPrice`). */
  minPrice?: number;
  /** Inclusive upper price bound (`maxPrice`). */
  maxPrice?: number;
  /** Minimum average rating, 0..5 (`minRating`). */
  minRating?: number;
  /** `relevance` | `price_asc` | `price_desc` | `rating_desc`. */
  sort?: string;
  /** Zero-based page index. */
  page?: number;
  /** Page size (backend default 20, max 100). */
  size?: number;
};

export const queryKeys = {
  /**
   * Current authenticated user (`GET /api/v1/users/me`).
   * Only used when the user is authenticated; cached per session.
   */
  user: {
    /** Prefix that matches current-user queries. */
    all: ['user'] as const,
    /** Current authenticated user profile. */
    me: () => ['user', 'me'] as const,
  },

  /**
   * Public catalog (`GET /api/v1/products`, `GET /api/v1/products/{id}`).
   * The filters object is part of the key so each filter combination has its
   * own cache entry and pagination is invalidated as a whole.
   */
  products: {
    /** Prefix that matches every product list query. */
    all: ['products'] as const,
    /** One filtered/paginated list page. */
    list: (filters: ProductListFilters = {}) => ['products', 'list', filters] as const,
    /** One product detail. */
    detail: (productId: string) => ['products', 'detail', productId] as const,
    /** Products from the same shop/seller, scoped to sellerId and current product. */
    sameShop: (sellerId: string, currentProductId: string) =>
      ['products', 'sameShop', sellerId, currentProductId] as const,
  },

  /**
   * Seller product management (`/api/v1/seller/products`).
   */
  sellerProducts: {
    /** Prefix matching every seller product query. */
    all: ['sellerProducts'] as const,
    /** Seller product list with filters. */
    list: (filters: SellerProductListFilters = {}) =>
      ['sellerProducts', 'list', filters] as const,
    /** Seller product detail. */
    detail: (productId: string) => ['sellerProducts', 'detail', productId] as const,
  },

  /** Public categories (`GET /api/v1/categories`). */
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },

  /** Public seller shop (`GET /api/v1/sellers/{id}`). */
  sellers: {
    all: ['sellers'] as const,
    shop: (sellerId: string) => ['sellers', 'shop', sellerId] as const,
  },

  /**
   * Customer cart (`GET /api/v1/cart` and its item mutations). Only enabled
   * for an authenticated CUSTOMER; the cache is purged whenever the account
   * identity changes.
   */
  cart: {
    all: ['cart'] as const,
    current: () => ['cart', 'current'] as const,
  },

  /** Customer orders (list/detail/confirm received). */
  orders: {
    all: ['orders'] as const,
    /** Prefix matching every order list page (infinite query). */
    lists: ['orders', 'list'] as const,
    list: (page: number) => ['orders', 'list', page] as const,
    detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  },

  /** Product reviews (backend review API not implemented yet). */
  reviews: {
    all: ['reviews'] as const,
    byProduct: (productId: string) => ['reviews', 'product', productId] as const,
  },

  /** Customer shipments (backend shipment API not implemented yet). */
  shipments: {
    all: ['shipments'] as const,
    byOrder: (orderId: string) => ['shipments', 'order', orderId] as const,
  },

  /**
   * Seller fulfillment queries and mutations.
   * Independent cache identities for order items, shipments, and carriers.
   */
  sellerFulfillment: {
    all: ['sellerFulfillment'] as const,
    orderItems: {
      all: ['sellerFulfillment', 'orderItems'] as const,
      list: (params: SellerOrderItemFilterParams = {}) =>
        ['sellerFulfillment', 'orderItems', 'list', params] as const,
    },
    shipments: {
      all: ['sellerFulfillment', 'shipments'] as const,
      list: (params: SellerShipmentFilterParams = {}) =>
        ['sellerFulfillment', 'shipments', 'list', params] as const,
    },
    carriers: {
      all: ['sellerFulfillment', 'carriers'] as const,
      list: () => ['sellerFulfillment', 'carriers', 'list'] as const,
    },
  },
  /**
   * AI Assistant chat sessions and message history.
   */
  ai: {
    all: ['ai'] as const,
    sessions: () => ['ai', 'sessions'] as const,
    sessionMessages: (sessionId: string) => ['ai', 'sessions', sessionId, 'messages'] as const,
  },
  /**
   * Human real-time Customer–Seller Chat.
   */
  chat: {
    all: ['chat'] as const,
    conversations: () => ['chat', 'conversations'] as const,
    messages: (conversationId: string) =>
      ['chat', 'conversations', conversationId, 'messages'] as const,
    paginatedMessages: (conversationId: string, page: number) =>
      ['chat', 'conversations', conversationId, 'messages', page] as const,
  },
  /**
   * Platform vouchers (customer validation and checkout).
   */
  vouchers: {
    all: ['vouchers'] as const,
    usable: () => ['vouchers', 'usable'] as const,
  },
  /**
   * Admin portal queries and mutations.
   */
  admin: {
    all: ['admin'] as const,
    sellers: {
      all: ['admin', 'sellers'] as const,
      list: (params: { search?: string; page?: number; size?: number } = {}) =>
        ['admin', 'sellers', 'list', params] as const,
    },
    users: {
      all: ['admin', 'users'] as const,
      list: (params: { role?: string; search?: string; page?: number; size?: number } = {}) =>
        ['admin', 'users', 'list', params] as const,
      detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    },
    vouchers: {
      all: ['admin', 'vouchers'] as const,
      list: (params: { page?: number; size?: number } = {}) =>
        ['admin', 'vouchers', 'list', params] as const,
    },
    carriers: {
      all: ['admin', 'carriers'] as const,
      list: () => ['admin', 'carriers', 'list'] as const,
    },
  },
} as const;
