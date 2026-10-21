/**
 * Seller shop API service - thin wrapper over the public backend endpoint.
 *
 * Uses the shared `apiClient` (so the base URL, the Bearer header and the
 * 401/refresh behavior all come from the existing API layer) and the shared
 * `unwrapData` helper, which turns the backend's `ApiResponse` envelope into
 * the payload or throws a typed `ApiError`.
 *
 * Contract verified against the backend source:
 * - GET /sellers/{id} -> ApiResponse<SellerShopResponse>
 *
 * The endpoint is public (Spring Security permits GET on /sellers/**), so a
 * guest can open a shop. It answers 404 RESOURCE_NOT_FOUND when the id does
 * not exist, is not a seller, or the seller is not APPROVED.
 *
 * The seller's products are NOT fetched here: they come from the public
 * catalog endpoint GET /products?sellerId={id}, which is already served by
 * productService.
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type { SellerShopDto } from '../types/sellerApi';

export async function getSellerShop(sellerId: string): Promise<SellerShopDto> {
  const response = await apiClient.get<ApiResponse<SellerShopDto>>(`/sellers/${sellerId}`);
  return unwrapData(response);
}
