/**
 * Mock product catalog used until the backend API is connected.
 *
 * Lives in its own module (not inside screens) so screens only read data and
 * the whole file can be dropped once the real feature API module exists.
 * Categories are never hard-coded elsewhere — derive them with
 * `getAllCategories()` so filter chips stay in sync with the data.
 *
 * Images are local assets under `src/assets/products/`, loaded with
 * `require()` so they ship inside the app bundle and rendering never depends
 * on network availability or third-party hotlink/user-agent policies. The
 * photos were downloaded from Wikimedia Commons (see each file's Commons
 * page for its license). Where a photo of the exact model was unavailable, a
 * same-brand, same-product-type photo is used as a stand-in.
 */

import type { Product } from '../types/product';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    price: 12990000,
    originalPrice: 14990000,
    image: require('../assets/products/iphone-15-pro.jpg'),
    rating: 4.8,
    reviewCount: 245,
    category: 'Phones',
    description:
      'Apple flagship with the A17 Pro chip, a 48MP camera and a premium titanium frame. Supports the Action Button and high-speed USB-C.',
  },
  {
    id: 'samsung-galaxy-s24',
    name: 'Samsung Galaxy S24',
    price: 15990000,
    originalPrice: 17990000,
    image: require('../assets/products/samsung-galaxy-s24.png'),
    rating: 4.6,
    reviewCount: 182,
    category: 'Phones',
    description:
      'AMOLED 120Hz display, a powerful Exynos chip and an AI camera system that supports professional photo editing.',
  },
  {
    id: 'xiaomi-redmi-note-13',
    name: 'Xiaomi Redmi Note 13',
    price: 4990000,
    image: require('../assets/products/xiaomi-redmi-note-13.jpg'),
    rating: 4.5,
    reviewCount: 512,
    category: 'Phones',
    description:
      'A 6.67-inch AMOLED display, 33W fast charging and a 108MP camera - the most popular mid-range choice.',
  },
  {
    id: 'macbook-air-m3',
    name: 'MacBook Air M3',
    price: 27990000,
    originalPrice: 29990000,
    image: require('../assets/products/macbook-air-m3.jpg'),
    rating: 4.9,
    reviewCount: 130,
    category: 'Laptop',
    description:
      'Thin and light laptop with the Apple M3 chip, a Liquid Retina display and up to 18 hours of battery life.',
  },
  {
    id: 'dell-xps-13',
    name: 'Dell XPS 13',
    price: 32990000,
    image: require('../assets/products/dell-xps-13.png'),
    rating: 4.7,
    reviewCount: 89,
    category: 'Laptop',
    description:
      'Premium ultrabook with an InfinityEdge display, a comfortable keyboard and strong performance for heavy workloads.',
  },
  {
    id: 'asus-zenbook-14',
    name: 'ASUS Zenbook 14',
    price: 21990000,
    originalPrice: 23990000,
    image: require('../assets/products/asus-zenbook-14.jpg'),
    rating: 4.4,
    reviewCount: 76,
    category: 'Laptop',
    description:
      'Thin and light OLED laptop that balances performance and portability for working anytime, anywhere.',
  },
  {
    id: 'sony-wh1000xm5',
    name: 'Sony WH-1000XM5',
    price: 7990000,
    originalPrice: 8990000,
    image: require('../assets/products/sony-wh1000xm5.jpg'),
    rating: 4.9,
    reviewCount: 340,
    category: 'Tai nghe',
    description:
      'Top-tier over-ear active noise-cancelling headphones with detailed sound and up to 30 hours of battery life.',
  },
  {
    id: 'airpods-pro-2',
    name: 'AirPods Pro 2',
    price: 5490000,
    image: require('../assets/products/airpods-pro-2.jpg'),
    rating: 4.8,
    reviewCount: 410,
    category: 'Tai nghe',
    description:
      'Wireless active noise-cancelling headphones with Spatial Audio support and a MagSafe charging case with Find My.',
  },
  {
    id: 'jbl-tune-770nc',
    name: 'JBL Tune 770NC',
    price: 2490000,
    originalPrice: 2990000,
    image: require('../assets/products/jbl-tune-770nc.jpg'),
    rating: 4.5,
    reviewCount: 158,
    category: 'Tai nghe',
    description:
      'Affordable wireless headphones with adaptive noise cancelling and up to 70 hours of music playback.',
  },
  {
    id: 'anker-65w-charger',
    name: 'Anker 65W GaN Charger',
    price: 990000,
    originalPrice: 1290000,
    image: require('../assets/products/anker-65w-charger.jpg'),
    rating: 4.7,
    reviewCount: 920,
    category: 'Accessories',
    description:
      'Compact 65W GaN charger that fast-charges a laptop, phone and tablet at the same time.',
  },
  {
    id: 'iphone-15-case',
    name: 'iPhone 15 Clear Case',
    price: 290000,
    image: require('../assets/products/iphone-15-case.jpg'),
    rating: 4.3,
    reviewCount: 65,
    category: 'Accessories',
    description:
      'Shock-resistant clear case that fits snugly and resists yellowing after long use.',
  },
  {
    id: 'keychron-k8',
    name: 'Keychron K8 Mechanical Keyboard',
    price: 1890000,
    originalPrice: 2199000,
    image: require('../assets/products/keychron-k8.jpg'),
    rating: 4.6,
    reviewCount: 145,
    category: 'Accessories',
    description:
      'Wireless TKL-layout mechanical keyboard with hot-swap switches and RGB lighting you can customize to your style.',
  },
];

/**
 * Unique categories in first-appearance order, derived from the data itself
 * so the filter list never duplicates what the products contain.
 */
export function getAllCategories(products: readonly Product[] = MOCK_PRODUCTS): string[] {
  const categories: string[] = [];
  for (const product of products) {
    if (!categories.includes(product.category)) {
      categories.push(product.category);
    }
  }
  return categories;
}
