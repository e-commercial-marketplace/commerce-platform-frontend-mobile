/**
 * Seller / Shop screen - the public shop page of a seller.
 * Customer-facing discovery screen.
 * Fully theme-aware with dynamic semantic tokens and localized strings.
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
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useOpenConversation } from '../hooks/useChat';
import { useProductList } from '../hooks/useProducts';
import { useSellerShop } from '../hooks/useSellers';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { Product } from '../types/product';

const PAGE_SIZE = 20;

export default function SellerShopScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'SellerShop'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
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
      setChatError('Không tìm thấy thông tin người bán.');
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
      setChatError(apiErr.message || 'Không thể mở cuộc trò chuyện. Vui lòng thử lại.');
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

  const hasSellerId = sellerId.length > 0;
  const isShopNotFound =
    !hasSellerId || (isShopError && shopError instanceof ApiError && shopError.status === 404);

  const shopErrorMessage =
    shopError instanceof Error
      ? shopError.message
      : t('catalog.couldNotLoadShop', 'Failed to load this shop. Please try again.');
  const productsErrorMessage =
    productsError instanceof Error
      ? productsError.message
      : t('catalog.couldNotLoad', 'Failed to load products. Please try again.');

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

  if (hasSellerId && isShopPending && shop === undefined) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="seller-shop-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('catalog.loadingProducts', 'Loading shop…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  function renderShopHeader() {
    if (isShopNotFound) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>🔍</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('catalog.shopNotFound', 'Shop not found')}
          </Text>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            {t('catalog.shopNotFoundHint', 'This shop is not available anymore.')}
          </Text>
        </View>
      );
    }

    if (isShopError) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('catalog.couldNotLoadShop', "Couldn't load this shop")}
          </Text>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>{shopErrorMessage}</Text>
          <Pressable
            onPress={() => refetchShop()}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            accessibilityRole="button"
            accessibilityLabel={t('catalog.retryLoadingShop', 'Retry loading shop')}
          >
            <Text style={styles.retryButtonText}>{t('catalog.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.shopHeader,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ShopAvatar name={shop?.name} size={64} />
        <View style={styles.shopInfo}>
          <Text style={[styles.shopName, { color: theme.text }]} numberOfLines={2}>
            {shop?.name ?? 'Shop'}
          </Text>
          <Text style={[styles.shopMeta, { color: theme.textSecondary }]}>
            {shop != null
              ? t(
                  'catalog.productsForSale',
                  `${shop.productCount} ${shop.productCount === 1 ? 'product' : 'products'} for sale`,
                  { count: shop.productCount },
                )
              : ' '}
          </Text>
        </View>
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
            accessibilityLabel={t('catalog.chatWithShop', 'Nhắn tin với shop')}
          >
            {isOpeningChat ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Text style={styles.chatWithShopIcon}>💬</Text>
                <Text style={[styles.chatWithShopText, { color: theme.primary }]}>
                  {t('catalog.chatWithShop', 'Nhắn tin với shop')}
                </Text>
              </>
            )}
          </Pressable>
        )}
        {chatError != null && (
          <Text style={[styles.chatErrorText, { color: theme.danger }]}>{chatError}</Text>
        )}
      </View>
    );
  }

  function renderProductsToolbar() {
    return (
      <View style={styles.toolbar}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('catalog.products', 'Products')}
        </Text>
        <View
          style={[
            styles.viewToggle,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Pressable
            onPress={() => setViewMode('grid')}
            style={[
              styles.toggleButton,
              viewMode === 'grid' && { backgroundColor: theme.primary },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'grid' }}
          >
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === 'grid' ? '#FFFFFF' : theme.textSecondary },
                viewMode === 'grid' && styles.toggleTextActive,
              ]}
            >
              {t('catalog.grid', 'Grid')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[
              styles.toggleButton,
              viewMode === 'list' && { backgroundColor: theme.primary },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
          >
            <Text
              style={[
                styles.toggleText,
                { color: viewMode === 'list' ? '#FFFFFF' : theme.textSecondary },
                viewMode === 'list' && styles.toggleTextActive,
              ]}
            >
              {t('catalog.list', 'List')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="seller-shop-screen"
    >
      <FlatList
        key={viewMode}
        data={products}
        renderItem={renderProduct}
        keyExtractor={(product) => product.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={Boolean(isFetching && !areProductsPending)}
        ListHeaderComponent={
          <View>
            {renderShopHeader()}
            {renderProductsToolbar()}
          </View>
        }
        ListEmptyComponent={
          areProductsError ? (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>⚠️</Text>
              <Text style={[styles.stateTitle, { color: theme.text }]}>
                {t('catalog.couldNotLoad', "Couldn't load products")}
              </Text>
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {productsErrorMessage}
              </Text>
              <Pressable
                onPress={() => refetchProducts()}
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.retryLoadingProducts', 'Retry loading products')}
              >
                <Text style={styles.retryButtonText}>{t('catalog.retry', 'Retry')}</Text>
              </Pressable>
            </View>
          ) : areProductsPending ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('catalog.loadingProducts', 'Loading products…')}
              </Text>
            </View>
          ) : (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>📦</Text>
              <Text style={[styles.stateTitle, { color: theme.text }]}>
                {t('catalog.noProductsFound', 'No products found')}
              </Text>
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('catalog.noShopProducts', 'This shop has no products listed yet.')}
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
                style={[
                  styles.pageButton,
                  { backgroundColor: theme.primary },
                  page === 0 && [
                    styles.pageButtonDisabled,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ],
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.previousPage', 'Previous page')}
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    page === 0 && [
                      styles.pageButtonTextDisabled,
                      { color: theme.textSecondary },
                    ],
                  ]}
                >
                  {t('catalog.previous', 'Previous')}
                </Text>
              </Pressable>
              <Text style={[styles.pageInfo, { color: theme.textSecondary }]}>
                {t('catalog.pageInfo', `Page ${page + 1} / ${totalPages}`, {
                  page: page + 1,
                  totalPages,
                })}
              </Text>
              <Pressable
                onPress={goToNextPage}
                disabled={page >= totalPages - 1}
                style={[
                  styles.pageButton,
                  { backgroundColor: theme.primary },
                  page >= totalPages - 1 && [
                    styles.pageButtonDisabled,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ],
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.nextPage', 'Next page')}
              >
                <Text
                  style={[
                    styles.pageButtonText,
                    page >= totalPages - 1 && [
                      styles.pageButtonTextDisabled,
                      { color: theme.textSecondary },
                    ],
                  ]}
                >
                  {t('catalog.next', 'Next')}
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
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  shopHeader: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  shopInfo: {
    flex: 1,
    minWidth: 140,
  },
  shopName: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  shopMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  chatWithShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  chatWithShopButtonDisabled: {
    opacity: 0.5,
  },
  chatWithShopButtonPressed: {
    opacity: 0.8,
  },
  chatWithShopIcon: {
    fontSize: 16,
  },
  chatWithShopText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatErrorText: {
    width: '100%',
    fontSize: 12,
    marginTop: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontWeight: '700',
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm - 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleTextActive: {
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
  },
  stateText: {
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
    borderRadius: radii.sm,
  },
  pageButtonDisabled: {
    borderWidth: 1,
  },
  pageButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pageButtonTextDisabled: {
    fontWeight: '500',
  },
  pageInfo: {
    fontSize: 13,
  },
});
