/**
 * Backend DTO for the public seller shop page.
 *
 * Verified against the backend source (SellerShopResponse, a Java record):
 * the shop exposes exactly three values - the seller id, the shop name and
 * the number of products currently on sale. The backend deliberately hides
 * the seller's email and any other personal data.
 *
 * There is NO rating, description, avatar/logo, address, join date, follower
 * count or shop status in this payload, so the UI must not display those
 * values instead of real backend data.
 */

export type SellerShopDto = {
  /** Seller UUID; it doubles as the shop identifier. */
  id: string;
  /** Shop name - the seller's full name. */
  name: string;
  /** Number of active (listed) products owned by this seller. */
  productCount: number;
};
