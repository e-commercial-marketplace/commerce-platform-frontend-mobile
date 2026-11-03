/**
 * Seller / Shop screen - the public shop page of a seller.
 *
 * Two independent backend calls feed this screen:
 * - GET /api/v1/sellers/{id}              -> the shop (name + listed product count);
 * - GET /api/v1/products?sellerId={id}    -> the seller's listed products.
 *
 * Both endpoints are public, so a guest can open a shop. The shop payload is
 * the only source for the shop identity: the backend exposes no rating,
 * description, avatar/logo, address, join date, follower count or shop
 * status, so none of those are displayed here.
 *
 * Server state comes from TanStack Query (`useSellerShop` / `useProductList`);
 * the screen owns only UI state (current page, layout mode). The four
 * outcomes are kept strictly separate:
 * - LOADING : the request is in flight and nothing has been received yet;
 * - ERROR   : the request failed - the real message and a Retry action;
 * - EMPTY   : the request succeeded and the seller really has no product;
 * - SUCCESS : the request succeeded and the products are rendered.
 */

import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, toApiError } from '../api/errors';
import ProductCard, { type ProductViewMode } from '../components/ProductCard';
import ShopAvatar from '../components/ShopAvatar';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useOpenConversation } from '../hooks/useChat';
import { useProductList } from '../hooks/useProducts';
import { useSellerShop } from '../hooks/useSellers';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { Product } from '../types/product';

/** Page size sent to the backend (its own default is 20, max 100). */
const PAGE_SIZE = 20;

export default function SellerShopScreen({ route, navigation }: AppNavigatorScreenProps<'SellerShop'>) {
  const { sellerId } = route.params;
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<ProductViewMode>('grid');

  const { user, isAuthenticated } = useAuth();
  const openConversationMutation = useOpenConversation();
  const [chatError, setChatError] = useState<string | null>(null);
  const isOpeningChatRef = useRef(false);

  const canShowChatAction = !isAuthenticated || user?.role === 'CUSTOMER';
  const isOpeningChat = openConversationMutation.isPending;

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
      setChatError('Seller information not found.');
      return;
    }

    isOpeningChatRef.current = true;
    setChatError(null);

    try {
      const conversation = await openConversationMutation.mutateAsync({
        sellerId,
      });

      navigation.navigate('ChatRoom', {
        conversationId: conversation.id,
        counterpartName: shop?.name,
        counterpartRole: 'SELLER',
      });
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setChatError(apiErr.message || 'Could not open the conversation. Please try again.');
    } finally {
      isOpeningChatRef.current = false;
    }
  };

  const {
    data: shop,
    isPending: isShopPending,
    isError: isShopError,
    error: shopError,
    refetch: refetchShop,
  } = useSellerShop(sellerId);

  // The seller's products come from the public catalog endpoint, filtered by
  // the same seller id; the existing product query convention is reused.
  const filters = useMemo(() => ({ sellerId, page, size: PAGE_SIZE }), [sellerId, page]);

  const {
    data: productData,
    isPending: areProductsPending,
    isError: areProductsError,
    error: productsError,
    refetch: refetchProducts,
    isFetching,
  } = useProductList(filters);

  const products = productData?.products ?? [];
  const totalPages = productData?.totalPages ?? 0;

  // A 404 means the shop does not exist (unknown id, not a seller, or the
  // seller is not approved) - a different outcome from a transport failure.
  // A route without a seller id can never resolve a shop either.
  const hasSellerId = sellerId.length > 0;
  const isShopNotFound =
    !hasSellerId || (isShopError && shopError instanceof ApiError && shopError.status === 404);

  const shopErrorMessage =
    shopError instanceof Error ? shopError.message : 'Failed to load this shop. Please try again.';
  const productsErrorMessage =
    productsError instanceof Error
      ? productsError.message
      : 'Failed to load products. Please try again.';

  function handleProductPress(product: Product) {
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  function goToPreviousPage() {
    if (page > 0) {
      setPage((current) => current - 1);
    }
  }

  function goToNextPage() {
    if (totalPages > 0 && page < totalPages - 1) {
      setPage((current) => current + 1);
    }
  }

  function renderProduct({ item }: ListRenderItemInfo<Product>) {
    return <ProductCard product={item} viewMode={viewMode} onPress={handleProductPress} />;
  }

  function handleRefresh() {
    void refetchProducts();
    void refetchShop();
  }

  // First load: nothing has been received yet - show a real loading state.
  if (hasSellerId && isShopPending && shop === undefined) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading shop…</Text>
        </View>
      </SafeAreaView>
    );
  }

  function renderShopHeader() {
    if (isShopNotFound) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>🔍</Text>
          <Text style={styles.stateTitle}>Shop not found</Text>
          <Text style={styles.stateText}>This shop is not available anymore.</Text>
        </View>
      );
    }

    if (isShopError) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Couldn&apos;t load this shop</Text>
          <Text style={styles.stateText}>{shopErrorMessage}</Text>
          <Pressable
            onPress={() => refetchShop()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Retry loading shop"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.shopHeader}>
        <ShopAvatar name={shop?.name} size={64} />
        <View style={styles.shopInfo}>
          <Text style={styles.shopName} numberOfLines={2}>
            {shop?.name ?? 'Shop'}
          </Text>
          <Text style={styles.shopMeta}>
            {shop != null
              ? `${shop.productCount} ${shop.productCount === 1 ? 'product' : 'products'} for sale`
              : ' '}
          </Text>
        </View>
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
            accessibilityLabel="Message the shop"
          >
            {isOpeningChat ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={styles.chatWithShopIcon}>💬</Text>
                <Text style={styles.chatWithShopText}>Message the shop</Text>
              </>
            )}
          </Pressable>
        )}
        {chatError != null && <Text style={styles.chatErrorText}>{chatError}</Text>}
      </View>
    );
  }

  function renderProductsToolbar() {
    return (
      <View style={styles.toolbar}>
        <Text style={styles.sectionTitle}>Products</Text>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setViewMode('grid')}
            style={[styles.toggleButton, viewMode === 'grid' && styles.toggleButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'grid' }}
          >
            <Text style={[styles.toggleText, viewMode === 'grid' && styles.toggleTextActive]}>
              Grid
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              List
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        key={viewMode}
        data={products}
        renderItem={renderProduct}
        keyExtractor={(product) => product.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={isFetching && !areProductsPending}
        ListHeaderComponent={
          <View>
            {renderShopHeader()}
            {renderProductsToolbar()}
          </View>
        }
        ListEmptyComponent={
          areProductsError ? (
            // A failed request is NOT an empty catalog: show the reason and a
            // retry action instead of an empty-state message.
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>⚠️</Text>
              <Text style={styles.stateTitle}>Couldn&apos;t load products</Text>
              <Text style={styles.stateText}>{productsErrorMessage}</Text>
              <Pressable
                onPress={() => refetchProducts()}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Retry loading products"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : areProductsPending ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>Loading products…</Text>
            </View>
          ) : (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>🏬</Text>
              <Text style={styles.stateTitle}>This shop has no products yet</Text>
              <Text style={styles.stateText}>
                Products this seller puts on sale will show up here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={goToPreviousPage}
                disabled={page === 0}
                style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Previous page"
              >
                <Text style={[styles.pageButtonText, page === 0 && styles.pageButtonTextDisabled]}>
                  Previous
                </Text>
              </Pressable>
              <Text style={styles.pageInfo}>
                Page {page + 1} / {totalPages}
              </Text>
              <Pressable
                onPress={goToNextPage}
                disabled={page >= totalPages - 1}
                style={[styles.pageButton, page >= totalPages - 1 && styles.pageButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Next page"
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    page >= totalPages - 1 && styles.pageButtonTextDisabled,
                  ]}
                >
                  Next
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  centerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chatWithShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
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
    marginTop: spacing.xs,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  shopInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  shopName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  shopMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm - 2,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  gridRow: {
    gap: spacing.sm,
  },
  stateBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  stateIcon: {
    fontSize: 36,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  stateText: {
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
    fontSize: 14,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  pageButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
  pageInfo: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
