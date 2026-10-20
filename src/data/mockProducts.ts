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
    category: 'Điện thoại',
    description:
      'Flagship của Apple với chip A17 Pro, camera 48MP và khung titan sang trọng. Hỗ trợ Action Button và USB-C tốc độ cao.',
  },
  {
    id: 'samsung-galaxy-s24',
    name: 'Samsung Galaxy S24',
    price: 15990000,
    originalPrice: 17990000,
    image: require('../assets/products/samsung-galaxy-s24.png'),
    rating: 4.6,
    reviewCount: 182,
    category: 'Điện thoại',
    description:
      'Màn hình AMOLED 120Hz, chip Exynos mạnh mẽ và hệ thống camera AI hỗ trợ chỉnh sửa ảnh chuyên nghiệp.',
  },
  {
    id: 'xiaomi-redmi-note-13',
    name: 'Xiaomi Redmi Note 13',
    price: 4990000,
    image: require('../assets/products/xiaomi-redmi-note-13.jpg'),
    rating: 4.5,
    reviewCount: 512,
    category: 'Điện thoại',
    description:
      'Màn hình AMOLED 6.67 inch, sạc nhanh 33W và camera 108MP — lựa chọn tầm trang được ưa chuộng nhất.',
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
      'Laptop mỏng nhẹ với chip Apple M3, màn hình Liquid Retina và thời lượng pin lên đến 18 giờ làm việc.',
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
      'Ultrabook cao cấp với màn hình InfinityEdge, bàn phím thoải mái và hiệu năng mạnh cho công việc nặng.',
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
      'Máy tính xách tay OLED mỏng nhẹ, cân bằng giữa hiệu năng và tính di động cho nhu cầu làm việc mọi lúc mọi nơi.',
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
      'Tai nghe over-ear chống ồn chủ động hàng đầu, chất âm chi tiết và thời lượng pin lên tới 30 giờ.',
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
      'Tai nghe không dây chống ồn chủ động, hỗ trợ Spatial Audio và hộp sạc MagSafe có định vị Find My.',
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
      'Tai nghe không dây giá tốt với chống ồn thích ứng và thời lượng pin lên đến 70 giờ nghe nhạc.',
  },
  {
    id: 'anker-65w-charger',
    name: 'Sạc Anker 65W GaN',
    price: 990000,
    originalPrice: 1290000,
    image: require('../assets/products/anker-65w-charger.jpg'),
    rating: 4.7,
    reviewCount: 920,
    category: 'Phụ kiện',
    description:
      'Củ sạc GaN nhỏ gọn công suất 65W, sạc nhanh đồng thời laptop, điện thoại và máy tính bảng.',
  },
  {
    id: 'iphone-15-case',
    name: 'Ốp lưng trong suốt iPhone 15',
    price: 290000,
    image: require('../assets/products/iphone-15-case.jpg'),
    rating: 4.3,
    reviewCount: 65,
    category: 'Phụ kiện',
    description:
      'Ốp lưng trong suốt chống sốc, ôm sát máy và hạn chế ố vàng sau thời gian dài sử dụng.',
  },
  {
    id: 'keychron-k8',
    name: 'Bàn phím cơ Keychron K8',
    price: 1890000,
    originalPrice: 2199000,
    image: require('../assets/products/keychron-k8.jpg'),
    rating: 4.6,
    reviewCount: 145,
    category: 'Phụ kiện',
    description:
      'Bàn phím cơ không dây layout TKL, hỗ trợ hot-swap switch và đèn RGB tùy chỉnh theo phong cách của bạn.',
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
