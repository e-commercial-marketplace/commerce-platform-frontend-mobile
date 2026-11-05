/**
 * Unit tests for the backend DTO -> UI Product mappers.
 */

import { mapProductDetailToProduct, mapProductSummaryToProduct } from '../productMapper';
import type { ProductDetailDto, ProductSummaryDto } from '../../types/productApi';

const summaryDto: ProductSummaryDto = {
  id: 'p-1',
  name: 'iPhone 15 Pro',
  description: 'Flagship phone',
  imageUrl: null,
  price: '29990000.00',
  stock: 8,
  ratingAverage: '4.70',
  reviewCount: 123,
  active: true,
  category: { id: 'c-1', name: 'Phones' },
  sellerId: 's-1',
};

describe('mapProductSummaryToProduct', () => {
  it('maps every scalar field from the DTO', () => {
    const product = mapProductSummaryToProduct(summaryDto);

    expect(product.id).toBe('p-1');
    expect(product.name).toBe('iPhone 15 Pro');
    expect(product.description).toBe('Flagship phone');
    expect(product.category).toBe('Phones');
    expect(product.sellerId).toBe('s-1');
    expect(product.reviewCount).toBe(123);
    expect(product.stock).toBe(8);
  });

  it('parses decimal strings into numbers', () => {
    const product = mapProductSummaryToProduct(summaryDto);

    expect(product.price).toBe(29990000);
    expect(product.rating).toBeCloseTo(4.7, 5);
  });

  it('uses a remote uri source when imageUrl is present', () => {
    const product = mapProductSummaryToProduct({
      ...summaryDto,
      imageUrl: 'https://cdn.example.com/iphone.jpg',
    });

    expect(product.image).toEqual({ uri: 'https://cdn.example.com/iphone.jpg' });
  });

  it('falls back to the bundled placeholder when imageUrl is null', () => {
    const product = mapProductSummaryToProduct({ ...summaryDto, imageUrl: null });

    expect(product.image).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
    expect(product.image).toBeDefined();
  });

  it('falls back to the bundled placeholder when imageUrl is blank', () => {
    const product = mapProductSummaryToProduct({ ...summaryDto, imageUrl: '   ' });

    expect(product.image).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
    expect(product.image).toBeDefined();
  });

  it('returns 0 for a non-numeric price instead of NaN', () => {
    const product = mapProductSummaryToProduct({ ...summaryDto, price: 'not-a-number' });

    expect(product.price).toBe(0);
  });

  it('always leaves originalPrice undefined (not supplied by the backend)', () => {
    const product = mapProductSummaryToProduct(summaryDto);

    expect(product.originalPrice).toBeUndefined();
  });
});

describe('mapProductDetailToProduct', () => {
  it('maps the detail DTO the same way as the summary DTO', () => {
    const detailDto: ProductDetailDto = {
      ...summaryDto,
      imageUrl: 'https://cdn.example.com/detail.jpg',
      price: '15990000.00',
      ratingAverage: '4.00',
    };

    const product = mapProductDetailToProduct(detailDto);

    expect(product.id).toBe('p-1');
    expect(product.image).toEqual({ uri: 'https://cdn.example.com/detail.jpg' });
    expect(product.price).toBe(15990000);
    expect(product.rating).toBeCloseTo(4.0, 5);
    expect(product.stock).toBe(8);
  });
});
