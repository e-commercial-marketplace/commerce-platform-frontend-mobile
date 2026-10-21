/**
 * Maps backend DTOs to frontend UI models.
 * Handles decimal string -> number conversion as per backend contract.
 */

import type { Product } from '../types/product';
import type { ProductDetailDto, ProductSummaryDto } from '../types/productApi';

function parseDecimalString(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 0;
  }
  // Return as number (PriceDisplay expects number; formatVND handles integers)
  return num;
}

const PLACEHOLDER_IMAGE = require('../assets/products/iphone-15-pro.jpg');

export function mapProductSummaryToProduct(dto: ProductSummaryDto): Product {
  const imageSource =
    dto.imageUrl && dto.imageUrl.trim().length > 0 ? { uri: dto.imageUrl } : PLACEHOLDER_IMAGE;

  return {
    id: dto.id,
    name: dto.name,
    price: parseDecimalString(dto.price),
    // originalPrice not provided by backend in MVP
    originalPrice: undefined,
    image: imageSource,
    rating: parseDecimalString(dto.ratingAverage),
    reviewCount: dto.reviewCount,
    category: dto.category.name,
    description: dto.description,
    sellerId: dto.sellerId,
    stock: typeof (dto as { stock?: number }).stock === 'number' ? (dto as { stock?: number }).stock : undefined,
  };
}

export function mapProductDetailToProduct(dto: ProductDetailDto): Product {
  const imageSource =
    dto.imageUrl && dto.imageUrl.trim().length > 0 ? { uri: dto.imageUrl } : PLACEHOLDER_IMAGE;

  return {
    id: dto.id,
    name: dto.name,
    price: parseDecimalString(dto.price),
    originalPrice: undefined,
    image: imageSource,
    rating: parseDecimalString(dto.ratingAverage),
    reviewCount: dto.reviewCount,
    category: dto.category.name,
    description: dto.description,
    sellerId: dto.sellerId,
    stock: typeof (dto as { stock?: number }).stock === 'number' ? (dto as { stock?: number }).stock : undefined,
  };
}
