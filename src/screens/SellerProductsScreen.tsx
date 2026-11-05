/**
 * Seller Products Workspace Screen (Phase 3).
 *
 * Implements:
 * - Paginated seller product listing
 * - Server-side search with debounced input (~400ms)
 * - Server-side status filtering (ALL, LISTED, UNLISTED - preserving active=false)
 * - Explicit Previous / Next pagination with page-0 reset on filter/search change
 * - Pull-to-refresh via TanStack Query refetch
 * - Comprehensive states: Loading, Error with Retry, 403 Approval Blocked, Empty (initial vs filtered)
 * - Product actions: Create, Edit, Absolute Stock Update, Unlist (with confirmation), Relist (with imageUrl invariant check)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import SellerProductCard from '../components/seller/SellerProductCard';
import SellerProductFilters from '../components/seller/SellerProductFilters';
import UpdateProductStockModal from '../components/seller/UpdateProductStockModal';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAppTheme } from '../theme';
import { useAppLanguage } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  useDeleteSellerProduct,
  useSellerProducts,
  useUpdateSellerProduct,
  useUpdateSellerProductStock,
} from '../hooks/useSellerProducts';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type {
  PageResponseDto,
  ProductSummaryDto,
  SellerProductListFilters,
} from '../types/sellerProductApi';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export default function SellerProductsScreen({
  navigation,
}: AppNavigatorScreenProps<'SellerProducts'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { user, isAuthenticated } = useAuth();
  const isSeller = isAuthenticated && user?.role === 'SELLER';

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const [selectedStatus, setSelectedStatus] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(0);

  // Modal & Action State
  const [selectedProductForStock, setSelectedProductForStock] = useState<ProductSummaryDto | null>(
    null,
  );
  const [isStockModalVisible, setIsStockModalVisible] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);

  // Reset page to 0 when debounced search query changes
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  // Query filters memo
  const filters: SellerProductListFilters = useMemo(
    () => ({
      q: debouncedQuery.trim().length > 0 ? debouncedQuery.trim() : undefined,
      active: selectedStatus,
      page,
      size: PAGE_SIZE,
    }),
    [debouncedQuery, selectedStatus, page],
  );

  // Queries & Mutations
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSellerProducts(filters, isSeller);

  const updateProductMutation = useUpdateSellerProduct();
  const updateStockMutation = useUpdateSellerProductStock();
  const deleteProductMutation = useDeleteSellerProduct();

  // Handlers for search & filters
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleStatusChange = (status: boolean | undefined) => {
    setSelectedStatus(status);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedStatus(undefined);
    setPage(0);
  };

  // Handlers for navigation
  const handleNavigateCreate = () => {
    navigation.navigate('SellerProductForm', { mode: 'create' });
  };

  const handleEdit = (product: ProductSummaryDto) => {
    navigation.navigate('SellerProductForm', { mode: 'edit', productId: product.id });
  };

  // Stock update
  const handleOpenStock = (product: ProductSummaryDto) => {
    setSelectedProductForStock(product);
    setIsStockModalVisible(true);
  };

  const handleSaveStock = async (newStock: number) => {
    if (!selectedProductForStock) return;
    const targetProduct = selectedProductForStock;
    try {
      await updateStockMutation.mutateAsync({
        id: targetProduct.id,
        stock: newStock,
      });
      setIsStockModalVisible(false);
      setSelectedProductForStock(null);
      Alert.alert(
        t('seller.stockUpdatedTitle', 'Stock Updated'),
        t('seller.stockUpdatedMsg', `Stock for "${targetProduct.name}" updated to ${newStock}.`, {
          name: targetProduct.name,
          count: newStock,
        }),
      );
    } catch (err) {
      const apiError = toApiError(err);
      Alert.alert(t('seller.stockUpdateFailed', 'Stock Update Failed'), apiError.message);
    }
  };

  const handleCancelStock = () => {
    if (!updateStockMutation.isPending) {
      setIsStockModalVisible(false);
      setSelectedProductForStock(null);
    }
  };

  // Unlist handler (confirmation required)
  const handleUnlist = (product: ProductSummaryDto) => {
    Alert.alert(
      t('seller.unlistPromptTitle', 'Unlist Product'),
      t(
        'seller.unlistPromptMsg',
        `Are you sure you want to unlist "${product.name}"? This hides the product from the marketplace without deleting order history.`,
        { name: product.name },
      ),
      [
        { text: t('seller.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('seller.unlist', 'Unlist'),
          style: 'destructive',
          onPress: async () => {
            setUpdatingProductId(product.id);
            try {
              await deleteProductMutation.mutateAsync(product.id);
              Alert.alert(
                t('seller.productUnlistedTitle', 'Product Unlisted'),
                t('seller.productUnlistedMsg', `"${product.name}" has been unlisted.`, {
                  name: product.name,
                }),
              );
            } catch (err) {
              const apiError = toApiError(err);
              Alert.alert(t('seller.unlistFailed', 'Unlist Failed'), apiError.message);
            } finally {
              setUpdatingProductId(null);
            }
          },
        },
      ],
    );
  };

  // Relist handler (imageUrl invariant check)
  const handleRelist = async (product: ProductSummaryDto) => {
    const hasImage = Boolean(product.imageUrl && product.imageUrl.trim().length > 0);
    if (!hasImage) {
      Alert.alert(
        t('seller.relistImageRequiredTitle', 'Image Required'),
        t(
          'seller.relistImageRequiredMsg',
          'An image is required before relisting this product. Please edit the product and provide an image.',
        ),
        [
          { text: t('seller.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('seller.editProductAction', 'Edit Product'),
            onPress: () =>
              navigation.navigate('SellerProductForm', {
                mode: 'edit',
                productId: product.id,
              }),
          },
        ],
      );
      return;
    }

    setUpdatingProductId(product.id);
    try {
      await updateProductMutation.mutateAsync({
        id: product.id,
        payload: { active: true },
      });
      Alert.alert(
        t('seller.productRelistedTitle', 'Product Relisted'),
        t('seller.productRelistedMsg', `"${product.name}" has been relisted.`, {
          name: product.name,
        }),
      );
    } catch (err) {
      const apiError = toApiError(err);
      Alert.alert(t('seller.relistFailed', 'Relist Failed'), apiError.message);
    } finally {
      setUpdatingProductId(null);
    }
  };

  // Data preservation across background refetches
  const hasLoadedOnceRef = useRef(false);
  const previousDataRef = useRef<PageResponseDto<ProductSummaryDto> | null>(null);

  if (data) {
    hasLoadedOnceRef.current = true;
    previousDataRef.current = data;
  }

  // Preserve previous data during background fetching to avoid UI unmounts/resets
  const effectiveData = data ?? (isFetching ? previousDataRef.current : null);
  const products = effectiveData?.content ?? [];
  const totalPages = effectiveData?.totalPages ?? 0;
  const totalElements = effectiveData?.totalElements ?? 0;

  // Initial load is true only when the screen has never loaded any data and is currently loading
  const isInitialLoading = isLoading && !hasLoadedOnceRef.current;

  // Pagination handlers
  const handlePreviousPage = () => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) {
      setPage((prev) => prev + 1);
    }
  };

  // Role check guard
  if (!isAuthenticated || user?.role !== 'SELLER') {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="seller-access-required-state"
      >
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('seller.accessRestrictedTitle', 'Seller Access Required')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t(
              'seller.accessRestrictedSubtitle',
              'This area is only accessible to authenticated seller accounts.',
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 403 Seller Approval Blocked State
  if (isError) {
    const apiError = toApiError(error);
    if (apiError.status === 403) {
      return (
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.background }]}
          edges={['top']}
          testID="seller-approval-blocked-state"
        >
          <View
            style={[
              styles.header,
              { backgroundColor: theme.surface, borderBottomColor: theme.border },
            ]}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              {t('seller.productsWorkspace', 'My Products')}
            </Text>
          </View>
          <View style={styles.centerState}>
            <Text style={[styles.errorTitle, { color: theme.danger }]}>
              {t('seller.approvalRequiredTitle', 'Account Not Approved')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t(
                'seller.approvalRequiredSubtitle',
                'Your seller account is not currently approved to manage products.',
              )}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                onPress={() => void refetch()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading products"
                testID="approval-retry-button"
              >
                <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>
                  {t('seller.retry', 'Retry')}
                </Text>
              </Pressable>
              {navigation.canGoBack?.() ? (
                <Pressable
                  style={[
                    styles.retryButton,
                    styles.secondaryButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  testID="approval-back-button"
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
                    {t('orders.cancel', 'Go Back')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      );
    }
  }

  // Render list footer (Pagination)
  const renderFooter = () => {
    if (totalElements === 0) {
      return null;
    }

    return (
      <View
        style={[styles.pagination, { borderTopColor: theme.border }]}
        testID="seller-products-pagination"
      >
        <Pressable
          onPress={handlePreviousPage}
          disabled={page === 0 || isFetching}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (page === 0 || isFetching) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('seller.previous', 'Previous page')}
          testID="pagination-prev"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (page === 0 || isFetching) && [
                styles.pageButtonTextDisabled,
                { color: theme.textSecondary },
              ],
            ]}
          >
            {t('seller.previous', 'Previous')}
          </Text>
        </Pressable>

        <Text
          style={[styles.pageInfo, { color: theme.textSecondary }]}
          testID="pagination-info"
        >
          {t('seller.pageInfo', `Page ${page + 1} of ${Math.max(1, totalPages)}`, {
            current: page + 1,
            total: Math.max(1, totalPages),
          })}
        </Text>

        <Pressable
          onPress={handleNextPage}
          disabled={page >= totalPages - 1 || isFetching}
          style={[
            styles.pageButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
            (page >= totalPages - 1 || isFetching) && styles.pageButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('seller.next', 'Next page')}
          testID="pagination-next"
        >
          <Text
            style={[
              styles.pageButtonText,
              { color: theme.text },
              (page >= totalPages - 1 || isFetching) && [
                styles.pageButtonTextDisabled,
                { color: theme.textSecondary },
              ],
            ]}
          >
            {t('seller.next', 'Next')}
          </Text>
        </Pressable>
      </View>
    );
  };

  // Render empty / loading / generic error inside list
  const renderEmptyComponent = () => {
    if (isInitialLoading) {
      return (
        <View style={styles.centerState} testID="seller-products-loading">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('seller.loadingProducts', 'Loading products…')}
          </Text>
        </View>
      );
    }

    if (isError) {
      const apiError = toApiError(error);
      return (
        <View style={styles.centerState} testID="seller-products-error-state">
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('seller.loadProductsFailed', "Couldn't load products")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {apiError.message}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading products"
            testID="retry-button"
          >
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>
              {t('seller.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      );
    }

    const isFiltered = Boolean(debouncedQuery.trim().length > 0 || selectedStatus !== undefined);

    if (isFiltered) {
      return (
        <View style={styles.centerState} testID="seller-products-empty-filtered">
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('seller.noMatchingTitle', 'No matching products')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('seller.noMatchingSubtitle', 'No products matched your search or filter criteria.')}
          </Text>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={handleClearFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            testID="clear-filters-button"
          >
            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
              {t('seller.filterAll', 'Clear Filters')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerState} testID="seller-products-empty-initial">
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {t('seller.noProductsTitle', 'No products yet')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('seller.noProductsSubtitle', "You haven't added any products to your shop.")}
        </Text>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleNavigateCreate}
          accessibilityRole="button"
          accessibilityLabel="Create product"
          testID="empty-create-button"
        >
          <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>
            {t('seller.addProduct', '+ Add Product')}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="seller-products-screen"
    >
      {/* Top Header Bar */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('seller.productsWorkspace', 'My Products')}
          </Text>
          {totalElements > 0 ? (
            <Text style={[styles.countBadge, { color: theme.textSecondary }]}>
              ({totalElements})
            </Text>
          ) : null}
          {isFetching && !isInitialLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              testID="seller-products-fetching-indicator"
            />
          ) : null}
        </View>
        <Pressable
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={handleNavigateCreate}
          accessibilityRole="button"
          accessibilityLabel="Add new product"
          testID="create-product-button"
        >
          <Text style={[styles.createButtonText, { color: theme.onPrimary }]}>
            {t('seller.addProduct', '+ Add Product')}
          </Text>
        </Pressable>
      </View>

      {/* Permanent Filters Toolbar: Outside FlatList so TextInput lifecycle & focus are preserved */}
      <View style={styles.headerSection}>
        <SellerProductFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          disabled={false}
        />
      </View>

      {/* Main FlatList */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SellerProductCard
            product={item}
            onEdit={handleEdit}
            onUpdateStock={handleOpenStock}
            onUnlist={handleUnlist}
            onRelist={handleRelist}
            disabled={updatingProductId === item.id || updateStockMutation.isPending}
          />
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={[
          styles.listContent,
          products.length === 0 && styles.emptyListContent,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isInitialLoading}
            onRefresh={() => void refetch()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        testID="seller-products-list"
      />

      {/* Stock Update Modal */}
      <UpdateProductStockModal
        visible={isStockModalVisible}
        product={selectedProductForStock}
        pending={updateStockMutation.isPending}
        onCancel={handleCancelStock}
        onSave={handleSaveStock}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    fontSize: typography.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  createButtonText: {
    color: colors.onPrimary,
    fontSize: typography.md,
    fontWeight: '600',
  },
  headerSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: 280,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.base,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
    maxWidth: 280,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  actionButtonText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.base,
    fontWeight: '600',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
  pageInfo: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
});
