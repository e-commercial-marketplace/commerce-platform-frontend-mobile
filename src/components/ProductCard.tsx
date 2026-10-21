/**
 * Product card used by both catalog layouts. Receives a Product and an
 * onPress callback — navigation stays in the screen, not here.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';
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
  const handlePress = () => onPress(product);
  const accessibilityLabel = `${product.name}, ${product.rating.toFixed(1)} stars`;

  if (viewMode === 'list') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <ProductImage source={product.image} style={styles.listImage} />
        <View style={styles.listBody}>
          <Text style={styles.listName} numberOfLines={2}>
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
      style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.gridImageFrame}>
        <ProductImage source={product.image} style={styles.gridImage} />
      </View>
      <Text style={styles.gridName} numberOfLines={2}>
        {product.name}
      </Text>
      <Rating rating={product.rating} reviewCount={product.reviewCount} />
      <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  // Grid layout
  gridCard: {
    flex: 1,
    // Caps the card at half the row: with an odd item count the last row
    // holds a single card, which would otherwise grow (flex: 1) to the full
    // row width. The cap keeps every card at 2-column width; paired cards
    // still split the row evenly (they shrink below the cap by the row gap).
    maxWidth: '50%',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  // Grid image: a plain View frame owns the square sizing (width from the
  // card via stretch, height from aspectRatio), while the Image is taken out
  // of the layout flow and only fills the frame — cropping with "cover".
  // This keeps a tall photo from ever stretching the card vertically.
  gridImageFrame: {
    alignSelf: 'stretch',
    aspectRatio: 1,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  gridImage: {
    ...StyleSheet.absoluteFill,
  },
  gridName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  // List layout
  listCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
});
