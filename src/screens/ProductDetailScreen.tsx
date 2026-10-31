/**
 * Product detail screen - powered by the real backend API.
 * Fetches product details using TanStack Query, displays real data, and
 * adds to the server-backed cart (Cart API) for authenticated customers.
 * Guests are sent to Login; seller/admin accounts cannot use the cart.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import Button from '../components/Button';
import PriceDisplay from '../components/PriceDisplay';
import ProductImage from '../components/ProductImage';
import Rating from '../components/Rating';
import ShopAvatar from '../components/ShopAvatar';
import ProductReviews from '../components/ProductReviews';
import WriteReviewModal from '../components/WriteReviewModal';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useOpenConversation } from '../hooks/useChat';
import { useProductDetail } from '../hooks/useProducts';
import { useSellerShop } from '../hooks/useSellers';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { Cart } from '../types/cart';
import { findCartLineByProductId } from '../utils/cartSelection';

/** How long the button keeps showing the "Added" confirmation. */
const FEEDBACK_MS = 1500;

/** Which footer action is currently talking to the backend. */
type PendingAction = 'add' | 'buy' | null;

export default function ProductDetailScreen({ route, navigation }: AppNavigatorScreenProps<'ProductDetail'>) {
  const { user, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [addedFeedback, setAddedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [writeReviewVisible, setWriteReviewVisible] = useState(false);
  const openConversationMutation = useOpenConversation();
  const [chatError, setChatError] = useState<string | null>(null);
  const isOpeningChatRef = useRef(false);

  const canShowChatAction = !isAuthenticated || user?.role === 'CUSTOMER';
  const isOpeningChat = openConversationMutation.isPending;

  const handleOpenWriteReview = () => {
    if (!isAuthenticated || user == null) {
      navigation.navigate('Login');
      return;
    }
    if (user.role === 'CUSTOMER') {
      setWriteReviewVisible(true);
    }
  };

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

  const cartDisabled = isAuthenticated && user?.role !== 'CUSTOMER';
  const busy = pendingAction != null;

  /** Shows the brief in-button confirmation and clears any previous one. */
  const showAddedFeedback = () => {
    setAddedFeedback(true);
    if (feedbackTimer.current != null) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => setAddedFeedback(false), FEEDBACK_MS);
  };

  /**
   * Shared entry point for both footer actions.
   *
   * Guests never get a local/guest cart: they are sent to Login. Sellers and
   * admins must not call the customer-only Cart API. The POST quantity is a
   * DELTA, so a 409 can still happen even when the product stock check passed.
   */
  const addSelectionToCart = async (): Promise<Cart | null> => {
    if (busy) {
      return null;
    }
    if (!isAuthenticated || user == null) {
      navigation.navigate('Login');
      return null;
    }
    if (user.role !== 'CUSTOMER') {
      return null;
    }

    const amount = maxQuantity == null ? quantity : Math.min(quantity, maxQuantity);
    setActionError(null);
    try {
      // The Cart POST returns the full authoritative cart. Buy Now resolves
      // the resulting cart-item id from that response (never items[0]).
      return await addItem(product.id, amount);
    } catch (error) {
      // Use the normalized backend message (e.g. insufficient stock) instead
      // of re-deriving the rule in the frontend.
      setActionError(toApiError(error).message);
      return null;
    }
  };

  const handleAddToCart = async () => {
    setPendingAction('add');
    try {
      const updatedCart = await addSelectionToCart();
      if (updatedCart != null) {
        showAddedFeedback();
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleBuyNow = async () => {
    setPendingAction('buy');
    try {
      const updatedCart = await addSelectionToCart();
      if (updatedCart == null) {
        return;
      }

      const line = findCartLineByProductId(updatedCart.items, product.id);
      if (line == null) {
        setActionError('The product could not be found in your cart. Please try again.');
        return;
      }

      navigation.navigate('Checkout', { cartItemIds: [line.id] });
    } finally {
      setPendingAction(null);
    }
  };

  // The owning seller, when the backend provided one.
  const sellerId = product.sellerId;

  const handleOpenChat = async () => {
    if (isOpeningChatRef.current || openConversationMutation.isPending) {
      return;
    }

    if (!isAuthenticated || user == null) {
      navigation.navigate('Login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      return;
    }

    if (!sellerId) {
      setChatError('Không tìm thấy thông tin người bán.');
      return;
    }

    isOpeningChatRef.current = true;
    setChatError(null);

    try {
      const conversation = await openConversationMutation.mutateAsync({
        sellerId,
        productId: product.id,
      });

      navigation.navigate('ChatRoom', {
        conversationId: conversation.id,
        counterpartName: shop?.name,
        counterpartRole: 'SELLER',
      });
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setChatError(apiErr.message || 'Không thể mở cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      isOpeningChatRef.current = false;
    }
  };

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

        <View style={styles.detailTopRow}>
          <View style={styles.categoryChip}><Text style={styles.categoryText}>{product.category}</Text></View>
          <Rating rating={product.rating} reviewCount={product.reviewCount} size={16} />
        </View>

        <Text style={styles.name}>{product.name}</Text>
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" />

        {sellerId != null && (
          <View style={styles.sellerSection}>
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

          {canShowChatAction && (
            <Pressable
              onPress={handleOpenChat}
              disabled={isOpeningChat}
              style={({ pressed }) => [
                styles.chatWithShopButton,
                isOpeningChat && styles.chatWithShopButtonDisabled,
                pressed && !isOpeningChat && styles.chatWithShopButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Nhắn tin với shop"
            >
              {isOpeningChat ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Text style={styles.chatWithShopIcon}>💬</Text>
                  <Text style={styles.chatWithShopText}>Nhắn tin với shop</Text>
                </>
              )}
            </Pressable>
          )}
          {chatError != null && <Text style={styles.chatErrorText}>{chatError}</Text>}
        </View>
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

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>
        <View style={styles.featureGrid}>
          <View style={styles.featureItem}><Text style={styles.featureIcon}>▧</Text><Text style={styles.featureText}>Secure delivery</Text></View>
          <View style={styles.featureItem}><Text style={styles.featureIcon}>↩</Text><Text style={styles.featureText}>30-day free return</Text></View>
          <View style={styles.featureItem}><Text style={styles.featureIcon}>☆</Text><Text style={styles.featureText}>Good reviews</Text></View>
          <View style={styles.featureItem}><Text style={styles.featureIcon}>♙</Text><Text style={styles.featureText}>Authorized shop</Text></View>
        </View>

        <View style={styles.divider} />
        <ProductReviews
          productId={product.id}
          productName={product.name}
          averageRating={product.rating}
          reviewCount={product.reviewCount}
          onOpenWriteReview={handleOpenWriteReview}
          canWriteReview={!isAuthenticated || user?.role === 'CUSTOMER'}
        />
      </ScrollView>

      <View style={styles.footer}>
        {isAuthenticated && cartDisabled && (
          <Text style={styles.cartNotice}>Cart is available for customer accounts only.</Text>
        )}
        {actionError != null && <Text style={styles.actionError}>{actionError}</Text>}
        <View style={styles.footerRow}>
          <Button
            title={addedFeedback ? 'Added to Cart ✓' : 'Add to Cart'}
            onPress={() => {
              void handleAddToCart();
            }}
            variant="secondary"
            style={styles.footerButton}
            disabled={busy || cartDisabled}
            loading={pendingAction === 'add'}
          />
          <Button
            title="Buy Now"
            onPress={() => {
              void handleBuyNow();
            }}
            variant="primary"
            style={styles.footerButton}
            disabled={busy || cartDisabled}
            loading={pendingAction === 'buy'}
          />
        </View>
      </View>
      <WriteReviewModal
        visible={writeReviewVisible}
        productId={product.id}
        productName={product.name}
        onClose={() => setWriteReviewVisible(false)}
      />
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
    aspectRatio: 1.22,
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
    lineHeight: 29,
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
  sellerSection: {
    gap: spacing.sm,
  },
  chatWithShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  chatWithShopButtonDisabled: {
    opacity: 0.6,
  },
  chatWithShopButtonPressed: {
    backgroundColor: '#E6F8FA',
  },
  chatWithShopIcon: {
    fontSize: 16,
  },
  chatWithShopText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  chatErrorText: {
    fontSize: typography.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
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
  cartNotice: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionError: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
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

  detailTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingVertical: spacing.sm },
  featureItem: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureIcon: { fontSize: 18, color: colors.primary },
  featureText: { fontSize: 13, color: colors.textSecondary },
});
