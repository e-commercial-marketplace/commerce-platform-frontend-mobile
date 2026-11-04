/**
 * Product detail screen - powered by the real backend API.
 * Fetches product details using TanStack Query, displays real data, and
 * adds to the server-backed cart (Cart API) for authenticated customers.
 * Guests are sent to Login; seller/admin accounts cannot use the cart.
 *
 * Fully theme-aware with dynamic semantic tokens and localized strings.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import Button from '../components/Button';
import PriceDisplay from '../components/PriceDisplay';
import SameShopProductCard from '../components/SameShopProductCard';
import ProductImage from '../components/ProductImage';
import ProductReviews from '../components/ProductReviews';
import Rating from '../components/Rating';
import ShopAvatar from '../components/ShopAvatar';
import WriteReviewModal from '../components/WriteReviewModal';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useOpenConversation } from '../hooks/useChat';
import { useProductDetail, useSameShopProducts } from '../hooks/useProducts';
import { useSellerShop } from '../hooks/useSellers';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { Cart } from '../types/cart';
import type { Product } from '../types/product';
import { findCartLineByProductId } from '../utils/cartSelection';

/** How long the button keeps showing the "Added" confirmation. */
const FEEDBACK_MS = 1500;

/** Which footer action is currently talking to the backend. */
type PendingAction = 'add' | 'buy' | null;

export default function ProductDetailScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'ProductDetail'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
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
  const sellerId = product?.sellerId;
  const { data: shop } = useSellerShop(sellerId ?? '');

  const sameShopQuery =
    typeof useSameShopProducts === 'function'
      ? useSameShopProducts(sellerId, productId)
      : { data: undefined, isLoading: false, isError: false };
  const sameShopProducts = sameShopQuery?.data;
  const isSameShopLoading =
    Boolean(sellerId && sellerId.length > 0) && (sameShopQuery?.isLoading ?? false);
  const isSameShopError = sameShopQuery?.isError ?? false;

  const displayedProducts = useMemo(() => {
    if (!sameShopProducts || isSameShopError) {
      return [];
    }
    return sameShopProducts.filter((p) => p.id !== productId && p.active !== false).slice(0, 8);
  }, [sameShopProducts, isSameShopError, productId]);

  const leftColumnProducts = useMemo(() => {
    return displayedProducts.filter((_, index) => index % 2 === 0);
  }, [displayedProducts]);

  const rightColumnProducts = useMemo(() => {
    return displayedProducts.filter((_, index) => index % 2 === 1);
  }, [displayedProducts]);

  useEffect(
    () => () => {
      if (feedbackTimer.current != null) {
        clearTimeout(feedbackTimer.current);
      }
    },
    [],
  );

  if (isPending && product === undefined) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="product-detail-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('product.loading', 'Loading product…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isNotFound = isError && (error as { status?: number | null })?.status === 404;

  if (isNotFound) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="product-detail-screen"
      >
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>😕</Text>
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>
            {t('product.notFound', 'Product not found')}
          </Text>
          <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
            {t('product.notFoundHint', "This product doesn't exist or is no longer available.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : t('product.couldNotLoad', 'Failed to load product. Please try again.');
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="product-detail-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('product.couldNotLoad', "Couldn't load this product")}
          </Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{errorMessage}</Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel={t('product.retryLoading', 'Retry loading product')}
          >
            <Text style={styles.retryButtonText}>{t('product.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="product-detail-screen"
      >
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>😕</Text>
          <Text style={[styles.notFoundTitle, { color: theme.text }]}>
            {t('product.notFound', 'Product not found')}
          </Text>
          <Text style={[styles.notFoundText, { color: theme.textSecondary }]}>
            {t('product.notFoundHint', "This product doesn't exist or is no longer available.")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxQuantity =
    typeof (product as { stock?: number }).stock === 'number' &&
    (product as { stock?: number }).stock! > 0
      ? (product as { stock?: number }).stock
      : undefined;
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

  const showAddedFeedback = () => {
    setAddedFeedback(true);
    if (feedbackTimer.current != null) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => setAddedFeedback(false), FEEDBACK_MS);
  };

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
      return await addItem(product.id, amount);
    } catch (error) {
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
        setActionError(
          t(
            'product.notFoundInCart',
            'The product could not be found in your cart. Please try again.',
          ),
        );
        return;
      }

      navigation.navigate('Checkout', { cartItemIds: [line.id] });
    } finally {
      setPendingAction(null);
    }
  };

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
      setChatError(t('product.sellerInfoNotFound', 'Seller information not found.'));
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
      setChatError(
        apiErr.message ||
          t('product.cannotOpenChat', 'Could not open the conversation. Please try again.'),
      );
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

  function handleSameShopProductPress(item: Product) {
    if (item.id === productId) {
      return;
    }
    if (typeof (navigation as any).push === 'function') {
      (navigation as any).push('ProductDetail', { productId: item.id });
    } else {
      navigation.navigate('ProductDetail', { productId: item.id });
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="product-detail-screen"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.imageFrame, { backgroundColor: theme.surfaceAlt }]}>
          <ProductImage source={product.image} style={styles.imageFill} />
        </View>

        <View style={styles.detailTopRow}>
          <View
            style={[
              styles.categoryChip,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.categoryText, { color: theme.primary }]}>
              {product.category}
            </Text>
          </View>
          <Rating rating={product.rating} reviewCount={product.reviewCount} size={16} />
        </View>

        <Text style={[styles.name, { color: theme.text }]}>{product.name}</Text>
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" />

        {sellerId != null && (
          <View
            style={[
              styles.sellerSection,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Pressable
              onPress={handleOpenShop}
              style={({ pressed }) => [styles.sellerRow, pressed && styles.sellerRowPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                shop != null
                  ? t('product.viewShopName', `View shop ${shop.name}`, { name: shop.name })
                  : t('product.viewShop', 'View shop')
              }
            >
              <ShopAvatar name={shop?.name} size={44} />
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerLabel, { color: theme.textSecondary }]}>
                  {t('product.soldBy', 'Sold by')}
                </Text>
                <Text style={[styles.sellerName, { color: theme.text }]} numberOfLines={1}>
                  {shop?.name ?? t('product.viewShop', 'View shop')}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
            </Pressable>

            {canShowChatAction && (
              <Pressable
                onPress={handleOpenChat}
                disabled={isOpeningChat}
                style={({ pressed }) => [
                  styles.chatWithShopButton,
                  { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                  isOpeningChat && styles.chatWithShopButtonDisabled,
                  pressed && !isOpeningChat && styles.chatWithShopButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('product.chatWithShop', 'Message the shop')}
              >
                {isOpeningChat ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Text style={styles.chatWithShopIcon}>💬</Text>
                    <Text style={[styles.chatWithShopText, { color: theme.primary }]}>
                      {t('product.chatWithShop', 'Message the shop')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {chatError != null && (
              <Text style={[styles.chatErrorText, { color: theme.danger }]}>{chatError}</Text>
            )}
          </View>
        )}

        <View style={styles.quantitySection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('product.quantity', 'Quantity')}
          </Text>
          <View style={styles.quantityRow}>
            <Pressable
              onPress={decreaseQuantity}
              disabled={!canDecrease}
              style={({ pressed }) => [
                styles.quantityButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
                !canDecrease && styles.quantityButtonDisabled,
                pressed && canDecrease && styles.quantityButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('product.decreaseQuantity', 'Decrease quantity')}
              accessibilityState={{ disabled: !canDecrease }}
            >
              <Text
                style={[
                  styles.quantityButtonText,
                  { color: theme.text },
                  !canDecrease && [styles.quantityButtonTextDisabled, { color: theme.textSecondary }],
                ]}
              >
                -
              </Text>
            </Pressable>
            <Text style={[styles.quantityValue, { color: theme.text }]}>{quantity}</Text>
            <Pressable
              onPress={increaseQuantity}
              disabled={!canIncrease}
              style={({ pressed }) => [
                styles.quantityButton,
                { backgroundColor: theme.surface, borderColor: theme.border },
                !canIncrease && styles.quantityButtonDisabled,
                pressed && canIncrease && styles.quantityButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('product.increaseQuantity', 'Increase quantity')}
              accessibilityState={{ disabled: !canIncrease }}
            >
              <Text
                style={[
                  styles.quantityButtonText,
                  { color: theme.text },
                  !canIncrease && [styles.quantityButtonTextDisabled, { color: theme.textSecondary }],
                ]}
              >
                +
              </Text>
            </Pressable>
            {maxQuantity != null && (
              <Text style={[styles.stockText, { color: theme.textSecondary }]}>
                {t('product.availableStock', `${maxQuantity} available`, { count: maxQuantity })}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('product.description', 'Description')}
        </Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {product.description}
        </Text>
        <View style={styles.featureGrid}>
          <View
            style={[
              styles.featureItem,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.featureIcon, { color: theme.primary }]}>▧</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('product.secureDelivery', 'Secure delivery')}
            </Text>
          </View>
          <View
            style={[
              styles.featureItem,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.featureIcon, { color: theme.primary }]}>↩</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('product.freeReturn30Days', '30-day free return')}
            </Text>
          </View>
          <View
            style={[
              styles.featureItem,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.featureIcon, { color: theme.primary }]}>☆</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('product.goodReviews', 'Good reviews')}
            </Text>
          </View>
          <View
            style={[
              styles.featureItem,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.featureIcon, { color: theme.primary }]}>♙</Text>
            <Text style={[styles.featureText, { color: theme.text }]}>
              {t('product.authorizedShop', 'Authorized shop')}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <ProductReviews
          productId={product.id}
          productName={product.name}
          averageRating={product.rating}
          reviewCount={product.reviewCount}
          onOpenWriteReview={handleOpenWriteReview}
          canWriteReview={!isAuthenticated || user?.role === 'CUSTOMER'}
        />

        {sellerId != null && !isSameShopError && (
          isSameShopLoading ? (
            <View style={styles.sameShopSection} testID="same-shop-loading">
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : displayedProducts.length > 0 ? (
            <View style={styles.sameShopSection} testID="same-shop-section">
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t('product.moreFromShop', 'More from this shop')}
              </Text>
              <View style={styles.sameShopGrid}>
                <View style={styles.sameShopColumn} testID="same-shop-column-left">
                  {leftColumnProducts.map((item) => (
                    <SameShopProductCard
                      key={item.id}
                      product={item}
                      onPress={handleSameShopProductPress}
                    />
                  ))}
                </View>
                <View style={styles.sameShopColumn} testID="same-shop-column-right">
                  {rightColumnProducts.map((item) => (
                    <SameShopProductCard
                      key={item.id}
                      product={item}
                      onPress={handleSameShopProductPress}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        {isAuthenticated && cartDisabled && (
          <Text style={[styles.cartNotice, { color: theme.textSecondary }]}>
            {t('product.cartCustomerOnly', 'Cart is available for customer accounts only.')}
          </Text>
        )}
        {actionError != null && (
          <Text style={[styles.actionError, { color: theme.danger }]}>{actionError}</Text>
        )}
        <View style={styles.footerRow}>
          <Button
            title={
              addedFeedback
                ? t('product.addedToCart', 'Added to Cart ✓')
                : t('product.addToCart', 'Add to Cart')
            }
            onPress={() => {
              void handleAddToCart();
            }}
            variant="secondary"
            style={styles.footerButton}
            disabled={busy || cartDisabled}
            loading={pendingAction === 'add'}
          />
          <Button
            title={t('product.buyNow', 'Buy Now')}
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
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  centerText: {
    fontSize: 14,
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  sellerSection: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sellerRowPressed: {
    opacity: 0.8,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerLabel: {
    fontSize: 12,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 22,
  },
  chatWithShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  chatWithShopButtonDisabled: {
    opacity: 0.5,
  },
  chatWithShopButtonPressed: {
    opacity: 0.8,
  },
  chatWithShopIcon: {
    fontSize: 15,
  },
  chatWithShopText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatErrorText: {
    fontSize: 12,
    marginTop: 2,
  },
  quantitySection: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonPressed: {
    opacity: 0.7,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  quantityButtonTextDisabled: {
    opacity: 0.5,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  stockText: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  featureIcon: {
    fontSize: 14,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cartNotice: {
    fontSize: 12,
    textAlign: 'center',
  },
  actionError: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  notFoundIcon: {
    fontSize: 48,
  },
  notFoundTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  notFoundText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sameShopSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sameShopGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  sameShopColumn: {
    flex: 1,
    gap: spacing.sm,
  },
});
