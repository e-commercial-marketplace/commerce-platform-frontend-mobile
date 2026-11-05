/**
 * Dedicated product card for "More Products From Same Shop" on Product Detail.
 * Uses natural content height (no vertical flex stretching) and 100% width of its grid column.
 * Theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppTheme } from '../theme';
import type { Product } from '../types/product';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';
import Rating from './Rating';

type SameShopProductCardProps = {
  product: Product;
  onPress: (product: Product) => void;
};

export default function SameShopProductCard({ product, onPress }: SameShopProductCardProps) {
  const { theme } = useAppTheme();
  const handlePress = () => onPress(product);
  const accessibilityLabel = `${product.name}, ${product.rating.toFixed(1)} stars`;

  return (
    <Pressable
      testID={`same-shop-card-${product.id}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.imageFrame, { backgroundColor: theme.background }]}>
        <ProductImage source={product.image} style={styles.image} />
      </View>
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
        {product.name}
      </Text>
      <Rating rating={product.rating} reviewCount={product.reviewCount} />
      <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  card: {
    width: '100%',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
});
