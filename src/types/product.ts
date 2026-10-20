/**
 * Domain model for a catalog product.
 *
 * Designed to be reused as-is when the mock data is replaced by the backend
 * API: fields use plain, API-friendly shapes (string ids, integer VND
 * amounts, string category) so a future feature API module can map DTOs
 * directly onto this type.
 *
 * The image field is the one React Native-specific shape: it uses RN's own
 * source union so both a local bundled asset and a remote URI are valid —
 * a future API module will map the backend image URL onto it.
 */

import type { ImageSourcePropType } from 'react-native';

export type Product = {
  /** Stable unique identifier; maps directly to the API product id. */
  id: string;
  /** Display name. */
  name: string;
  /** Current price in VND (integer amount, no decimals). */
  price: number;
  /** Pre-discount price in VND; present only when the product is on sale. */
  originalPrice?: number;
  /**
   * Product image source in either form accepted by React Native's Image:
   * a local asset id (`require()` of a bundled file) or a remote `{ uri }`
   * object. The mock stage uses local assets under src/assets/products/ so
   * rendering never depends on network availability.
   */
  image: ImageSourcePropType;
  /** Average rating from 0 to 5. */
  rating: number;
  /** Number of reviews backing the rating. */
  reviewCount: number;
  /** Category label used for both display and filtering. */
  category: string;
  /** Long description shown on the product detail screen. */
  description: string;
};
