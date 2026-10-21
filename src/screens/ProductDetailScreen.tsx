/**
 * Product detail screen - now powered by real backend API.
 * Fetches product details using TanStack Query, displays real data,
 * and allows adding to cart (local CartContext).
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import PriceDisplay from '../components/PriceDisplay';
import ProductImage from '../components/ProductImage';
import Rating from '../components/Rating';
import ShopAvatar from '../components/ShopAvatar';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useCart } from '../hooks/useCart';
import { useProductDetail } from '../hooks/useProducts';
import { useSellerShop } from '../hooks/useSellers';
import type { AppNavigatorScreenProps } from '../navigation/types';

/** How long the button keeps showing the "Added" confirmation. */
const FEEDBACK_MS = 1500;

export default function ProductDetailScreen({ route, navigation }: AppNavigatorScreenProps<'ProductDetail'>) {
  const { addItem } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { productId } = route.params;
  const { data: product, isPending, isError, error, refetch } = useProductDetail(productId);

  // The product DTO carries the id of the seller that owns it. The shop is
  // looked up under the same query key the shop page uses, so the name is
  // fetched once and the shop page then opens instantly. The lookup stays
  // disabled until a product with a seller has been loaded, and a failure
  // only removes the name - it never breaks the product screen.
  const { data: shop } = useSellerShop(product?.sellerId ?? '');

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

  // Nothing received yet: show a loading state, never a "not found" screen.
  if (isPending && product === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading product…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // A 404 means the product does not exist (or is no longer active) - that is
  // a different outcome from a transport/server failure and gets its own
  // screen instead of a retryable error.
  const isNotFound = isError && (error as { status?: number | null })?.status === 404;

  if (isNotFound) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>😕</Text>
          <Text style={styles.notFoundTitle}>Product not found</Text>
          <Text style={styles.notFoundText}>
            This product doesn&apos;t exist or is no longer available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load product. Please try again.';
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn&apos;t load this product</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            onPress={() => refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading product"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>😕</Text>
          <Text style={styles.notFoundTitle}>Product not found</Text>
          <Text style={styles.notFoundText}>
            This product doesn&apos;t exist or is no longer available.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxQuantity = typeof (product as { stock?: number }).stock === 'number' && (product as { stock?: number }).stock! > 0 ? (product as { stock?: number }).stock : undefined;
  const canDecrease = quantity > 1;
  const canIncrease = maxQuantity == null || quantity < maxQuantity;

  const decreaseQuantity = () => {
    if (!canDecrease) {
      return;
    }
    setQuantity((current) => current - 1);
  };

  const increaseQuantity = () => {
    if (!canIncrease) {
      return;
    }
    setQuantity((current) => current + 1);
  };

  const handleAddToCart = () => {
    const amount = maxQuantity == null ? quantity : Math.min(quantity, maxQuantity);
    addItem(product, amount);
    // Brief in-button confirmation; the user stays on this screen by design
    // (no automatic navigation to the Cart tab).
    setAddedFeedback(true);
    if (feedbackTimer.current != null) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => setAddedFeedback(false), FEEDBACK_MS);
  };

  const handleBuyNow = () => {
    const amount = maxQuantity == null ? quantity : Math.min(quantity, maxQuantity);
    addItem(product, amount);
    navigation.navigate('Main', { screen: 'Cart' });
  };

  // The owning seller, when the backend provided one.
  const sellerId = product.sellerId;

  function handleOpenShop() {
    if (sellerId == null) {
      return;
    }
    navigation.navigate('SellerShop', { sellerId });
  }

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

        {sellerId != null && (
          <Pressable
            onPress={handleOpenShop}
            style={({ pressed }) => [styles.sellerRow, pressed && styles.sellerRowPressed]}
            accessibilityRole="button"
            accessibilityLabel={shop != null ? `View shop ${shop.name}` : 'View shop'}
          >
            <ShopAvatar name={shop?.name} size={44} />
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerLabel}>Sold by</Text>
              <Text style={styles.sellerName} numberOfLines={1}>
                {shop?.name ?? 'View shop'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}

        <View style={styles.quantitySection}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <Pressable
              onPress={decreaseQuantity}
              disabled={!canDecrease}
              style={({ pressed }) => [
                styles.quantityButton,
                !canDecrease && styles.quantityButtonDisabled,
                pressed && canDecrease && styles.quantityButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              accessibilityState={{ disabled: !canDecrease }}
            >
              <Text style={[styles.quantityButtonText, !canDecrease && styles.quantityButtonTextDisabled]}>-</Text>
            </Pressable>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <Pressable
              onPress={increaseQuantity}
              disabled={!canIncrease}
              style={({ pressed }) => [
                styles.quantityButton,
                !canIncrease && styles.quantityButtonDisabled,
                pressed && canIncrease && styles.quantityButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              accessibilityState={{ disabled: !canIncrease }}
            >
              <Text style={[styles.quantityButtonText, !canIncrease && styles.quantityButtonTextDisabled]}>+</Text>
            </Pressable>
            {maxQuantity != null && (
              <Text style={styles.stockText}>{maxQuantity} available</Text>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Button
            title={addedFeedback ? 'Added to Cart ✓' : 'Add to Cart'}
            onPress={handleAddToCart}
            variant="secondary"
            style={styles.footerButton}
          />
          <Button title="Buy Now" onPress={handleBuyNow} variant="primary" style={styles.footerButton} />
        </View>
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
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sellerRowPressed: {
    opacity: 0.75,
  },
  sellerInfo: {
    flex: 1,
    gap: 2,
  },
  sellerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  chevron: {
    fontSize: 24,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  quantitySection: {
    gap: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantityButtonPressed: {
    opacity: 0.7,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  quantityButtonTextDisabled: {
    color: colors.textSecondary,
  },
  quantityValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  stockText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  centerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
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
