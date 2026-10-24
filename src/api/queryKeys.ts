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

  /** Customer orders (checkout creates one; list/detail screens are later). */
  orders: {
    all: ['orders'] as const,
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
} as const;
