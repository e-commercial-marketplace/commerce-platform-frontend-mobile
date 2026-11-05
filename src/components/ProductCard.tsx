/**
 * Product card used by both catalog layouts. Receives a Product and an
 * onPress callback — navigation stays in the screen, not here.
 * Theme-aware and supports semantic tokens for dark and light modes.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppTheme } from '../theme';
import type { Product } from '../types/product';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';
import Rating from './Rating';

/** Layout mode shared between HomeScreen and ProductCard. */
export type ProductViewMode = 'grid' | 'list';

type ProductCardProps = {
  product: Product;
  viewMode: ProductViewMode;
  onPress: (product: Product) => void;
};

export default function ProductCard({ product, viewMode, onPress }: ProductCardProps) {
  const { theme } = useAppTheme();
  const handlePress = () => onPress(product);
  const accessibilityLabel = `${product.name}, ${product.rating.toFixed(1)} stars`;

  if (viewMode === 'list') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.listCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <ProductImage source={product.image} style={styles.listImage} />
        <View style={styles.listBody}>
          <Text style={[styles.listName, { color: theme.text }]} numberOfLines={2}>
            {product.name}
          </Text>
          <Rating rating={product.rating} reviewCount={product.reviewCount} />
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.gridCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.gridImageFrame, { backgroundColor: theme.background }]}>
        <ProductImage source={product.image} style={styles.gridImage} />
      </View>
      <Text style={[styles.gridName, { color: theme.text }]} numberOfLines={2}>
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
  // Grid layout
  gridCard: {
    flex: 1,
    maxWidth: '50%',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
  },
  gridImageFrame: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  gridImage: {
    ...StyleSheet.absoluteFill,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  // List layout
  listCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
  },
  listImage: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
  },
  listBody: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  listName: {
    fontSize: 15,
    fontWeight: '600',
  },
});
