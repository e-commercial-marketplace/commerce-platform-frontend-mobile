/**
 * Product detail screen (mock stage): resolves the product by id from the
 * mock catalog. "Add to Cart" writes into the shared local cart state
 * (CartContext) and briefly confirms it in the button; cart persistence and
 * checkout arrive with later milestones.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PriceDisplay from '../components/PriceDisplay';
import ProductImage from '../components/ProductImage';
import Rating from '../components/Rating';
import { colors, radii, spacing } from '../constants/theme';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import { useCart } from '../hooks/useCart';
import type { AppNavigatorScreenProps } from '../navigation/types';

/** How long the button keeps showing the "Added" confirmation. */
const FEEDBACK_MS = 1500;

export default function ProductDetailScreen({ route }: AppNavigatorScreenProps<'ProductDetail'>) {
  const { addItem } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drops any pending feedback timer on unmount so setState never fires
  // after the user has navigated away.
  useEffect(
    () => () => {
      if (feedbackTimer.current != null) {
        clearTimeout(feedbackTimer.current);
      }
    },
    [],
  );

  const product = MOCK_PRODUCTS.find((candidate) => candidate.id === route.params.productId);

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>😕</Text>
          <Text style={styles.notFoundTitle}>Product not found</Text>
          <Text style={styles.notFoundText}>This product doesn&apos;t exist or is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleAddToCart = () => {
    addItem(product);
    // Brief in-button confirmation; the user stays on this screen by design
    // (no automatic navigation to the Cart tab).
    setAddedFeedback(true);
    if (feedbackTimer.current != null) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => setAddedFeedback(false), FEEDBACK_MS);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.imageFrame}>
          <ProductImage source={product.image} style={styles.imageFill} />
        </View>

        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{product.category}</Text>
        </View>

        <Text style={styles.name}>{product.name}</Text>

        <Rating rating={product.rating} reviewCount={product.reviewCount} size={16} />

        <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" />

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleAddToCart}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={addedFeedback ? 'Added to cart' : 'Add to cart'}
        >
          <Text style={styles.addButtonText}>
            {addedFeedback ? 'Added to Cart ✓' : 'Add to Cart'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  // Square image frame: the plain View owns the sizing (width +
  // aspectRatio) while the Image is taken out of the layout flow and only
  // fills the frame — cropping with "cover". Same proven pattern as the
  // catalog grid: the photo stays responsive, rounded and can never
  // stretch beyond the frame.
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  addButtonPressed: {
    opacity: 0.8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  notFoundIcon: {
    fontSize: 40,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  notFoundText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
