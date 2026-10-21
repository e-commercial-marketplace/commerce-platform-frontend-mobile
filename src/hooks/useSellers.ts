/**
 * TanStack Query hooks for the public seller shop.
 *
 * They reuse the foundation exactly as-is: the single app-wide `QueryClient`
 * (src/api/queryClient.ts) and the key factory (src/api/queryKeys.ts), where
 * the shop key `queryKeys.sellers.shop(sellerId)` was already declared for
 * this endpoint. No second client and no inline key literals are introduced.
 *
 * The hook is used by two screens (Product Detail and the shop page itself),
 * so both share one cache entry: the shop name is fetched once and the shop
 * page then renders instantly.
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { getSellerShop } from '../services/sellerService';

export type SellerShop = {
  /** Seller UUID; it doubles as the shop identifier. */
  id: string;
  /** Shop name - the seller's full name. */
  name: string;
  /** Number of active (listed) products owned by this seller. */
  productCount: number;
};

/**
 * The public shop of one seller. Disabled when there is no id to request,
 * so a screen can call it before the seller id is known.
 */
export function useSellerShop(sellerId: string) {
  return useQuery({
    queryKey: queryKeys.sellers.shop(sellerId),
    queryFn: () => getSellerShop(sellerId),
    enabled: sellerId.length > 0,
    select: (data): SellerShop => ({
      id: data.id,
      name: data.name,
      productCount: data.productCount,
    }),
  });
}
