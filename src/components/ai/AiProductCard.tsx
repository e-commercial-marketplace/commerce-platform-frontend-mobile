/**
 * Compact Product Recommendation Card for AI Assistant chat.
 *
 * Displays catalog product recommendation returned by POST /ai/ask:
 * - Product thumbnail (with fallback for missing or broken image URLs)
 * - Product title (max 2 lines)
 * - Average rating and review count
 * - Price formatted in VND via PriceDisplay
 * - Stock status badge: "Hết hàng" (stock 0), "Chỉ còn X" (1..5), "Còn hàng" (> 5)
 *
 * Tapping triggers onPress (navigation to ProductDetail). Does NOT trigger any API calls.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PriceDisplay from '../PriceDisplay';
import ProductImage from '../ProductImage';
import Rating from '../Rating';
import { colors, radii, spacing } from '../../constants/theme';
import type { AiProductResponse } from '../../types/aiApi';
import { formatVND } from '../../utils/format';

const PLACEHOLDER_IMAGE = require('../../assets/products/iphone-15-pro.jpg');

type AiProductCardProps = {
  product: AiProductResponse;
  onPress: (product: AiProductResponse) => void;
};

function parseDecimalString(value: string | undefined): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) || num < 0 ? 0 : num;
}

export function getStockStatus(stock: number): { label: string; bg: string; text: string } {
  if (stock <= 0) {
    return { label: 'Hết hàng', bg: '#FEE2E2', text: '#DC2626' };
  }
  if (stock <= 5) {
    return { label: `Chỉ còn ${stock}`, bg: '#FEF3C7', text: '#D97706' };
  }
  return { label: 'Còn hàng', bg: '#ECFDF5', text: '#059669' };
}

export default function AiProductCard({ product, onPress }: AiProductCardProps) {
  const safePrice = parseDecimalString(product.price);
  const safeRating = parseDecimalString(product.ratingAverage);
  const stockInfo = getStockStatus(product.stock);

  const imageSource =
    product.imageUrl && product.imageUrl.trim().length > 0
      ? { uri: product.imageUrl }
      : PLACEHOLDER_IMAGE;

  const accessibilityLabel = `${product.name}, ${formatVND(safePrice)}, ${stockInfo.label}`;

  return (
    <Pressable
      onPress={() => onPress(product)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.imageFrame}>
        <ProductImage source={imageSource} style={styles.image} />
        <View style={[styles.stockBadge, { backgroundColor: stockInfo.bg }]}>
          <Text style={[styles.stockBadgeText, { color: stockInfo.text }]}>{stockInfo.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Rating rating={safeRating} reviewCount={product.reviewCount} size={11} />
        <PriceDisplay price={safePrice} size="sm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 155,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginRight: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  imageFrame: {
    width: '100%',
    height: 105,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  body: {
    padding: spacing.sm,
    gap: 4,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 16,
    minHeight: 32,
  },
});
