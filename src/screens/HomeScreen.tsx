/**
 * Home / Product Catalog: powered by the real backend API.
 *
 * Server state comes from TanStack Query (`useProductList` /
 * `useCategories`); the screen owns only UI state (search text, selected
 * category, layout mode, current page).
 *
 * The four outcomes are kept strictly separate:
 * - LOADING : the request is in flight and nothing has been received yet;
 * - ERROR   : the request failed - the real message and a Retry action are
 *             shown, and the screen never claims "0 products" for a failure;
 * - EMPTY   : the request succeeded and the backend really has no matching
 *             product;
 * - SUCCESS : the request succeeded and the products are rendered.
 */

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import ProductCard, { type ProductViewMode } from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import VoucherRow from '../components/VoucherRow';
import SearchBar from '../components/SearchBar';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCategories, useProductList } from '../hooks/useProducts';
import { useUsableVouchers } from '../hooks/useVoucher';
import type { MainTabScreenProps } from '../navigation/types';
import type { Product } from '../types/product';
import { formatVND } from '../utils/format';

/** Local "no category filter" option; not a backend category. */
const ALL_CATEGORY = { id: 'all', name: 'All' };

/** Page size sent to the backend (its own default is 20, max 100). */
const PAGE_SIZE = 20;
const HOME_VOUCHER_COUNT = 5;

/** Debounce for the search field so one request is not fired per keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

export default function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const { user } = useAuth();
  const showAiEntry = user?.role !== 'SELLER' && user?.role !== 'ADMIN';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ProductViewMode>('grid');
  const [page, setPage] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | undefined>(undefined);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | undefined>(undefined);
  const [appliedMinRating, setAppliedMinRating] = useState<number | undefined>(undefined);
  const [filterError, setFilterError] = useState<string | null>(null);

  // The text field is instant; the server query follows the debounced value.
  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const { data: categoriesData } = useCategories();
  const categories = useMemo(() => {
    const apiCategories = categoriesData?.map((category) => ({
      id: category.id,
      name: category.name,
    }));
    return [ALL_CATEGORY, ...(apiCategories ?? [])];
  }, [categoriesData]);

  const filters = useMemo(() => {
    const next: {
      q?: string;
      categoryId?: string;
      page: number;
      size: number;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
    } = { page, size: PAGE_SIZE };

    const q = debouncedQuery.trim();
    if (q.length > 0) {
      next.q = q;
    }
    if (selectedCategoryId !== ALL_CATEGORY.id) {
      next.categoryId = selectedCategoryId;
    }
    if (appliedMinPrice !== undefined) {
      next.minPrice = appliedMinPrice;
    }
    if (appliedMaxPrice !== undefined) {
      next.maxPrice = appliedMaxPrice;
    }
    if (appliedMinRating !== undefined) {
      next.minRating = appliedMinRating;
    }
    return next;
  }, [debouncedQuery, selectedCategoryId, page, appliedMinPrice, appliedMaxPrice, appliedMinRating]);

  // While loading, on error or when empty the list is empty and the voucher section hides itself without affecting products.
  const vouchers = useUsableVouchers().data?.pages[0]?.content.slice(0, HOME_VOUCHER_COUNT) ?? [];
  const { data, isPending, isError, error, refetch, isFetching } = useProductList(filters);

  const products = data?.products ?? [];
  const categoryImageByName = useMemo(() => {
    const map = new Map<string, Product['image']>();
    for (const product of products) {
      if (!map.has(product.category)) map.set(product.category, product.image);
    }
    return map;
  }, [products]);
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  // `data` is only defined after a successful response: the counter must
  // never report "0 products" for a request that has not succeeded yet.
  const hasLoaded = data !== undefined;

  function handleProductPress(product: Product) {
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  function handleCategoryPress(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setPage(0);
  }

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    setPage(0);
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

  function openFilters() {
    setMinPrice(appliedMinPrice !== undefined ? String(appliedMinPrice) : '');
    setMaxPrice(appliedMaxPrice !== undefined ? String(appliedMaxPrice) : '');
    setMinRating(appliedMinRating !== undefined ? String(appliedMinRating) : '');
    setFilterError(null);
    setFilterVisible(true);
  }

  function applyFilters() {
    setFilterError(null);
    const minPriceNum = minPrice.trim() === '' ? undefined : Number(minPrice.trim());
    const maxPriceNum = maxPrice.trim() === '' ? undefined : Number(maxPrice.trim());
    const minRatingNum = minRating.trim() === '' ? undefined : Number(minRating.trim());

    if (minPrice.trim() !== '' && (Number.isNaN(minPriceNum) || (minPriceNum as number) < 0)) {
      setFilterError('Minimum price must be 0 or more.');
      return;
    }
    if (maxPrice.trim() !== '' && (Number.isNaN(maxPriceNum) || (maxPriceNum as number) < 0)) {
      setFilterError('Maximum price must be 0 or more.');
      return;
    }
    if (
      minPriceNum !== undefined &&
      maxPriceNum !== undefined &&
      (maxPriceNum as number) < (minPriceNum as number)
    ) {
      setFilterError('Maximum price must not be less than minimum price.');
      return;
    }
    if (minRating.trim() !== '') {
      if (Number.isNaN(minRatingNum) || (minRatingNum as number) < 0 || (minRatingNum as number) > 5) {
        setFilterError('Minimum rating must be between 0 and 5.');
        return;
      }
    }

    setAppliedMinPrice(minPriceNum);
    setAppliedMaxPrice(maxPriceNum);
    setAppliedMinRating(minRatingNum);
    setPage(0);
    setFilterVisible(false);
  }

  function clearFilters() {
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setFilterError(null);
    setAppliedMinPrice(undefined);
    setAppliedMaxPrice(undefined);
    setAppliedMinRating(undefined);
    setPage(0);
    setFilterVisible(false);
  }

  const hasActiveFilters =
    appliedMinPrice !== undefined || appliedMaxPrice !== undefined || appliedMinRating !== undefined;

  function renderProduct({ item }: ListRenderItemInfo<Product>) {
    return <ProductCard product={item} viewMode={viewMode} onPress={handleProductPress} />;
  }

  // First load: nothing has been received yet - show a real loading state
  // instead of an empty list that looks like "0 products".
  if (isPending && !hasLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading products…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const errorMessage =
    error instanceof Error ? error.message : 'Failed to load products. Please try again.';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        key={viewMode}
        data={products}
        renderItem={renderProduct}
        keyExtractor={(product) => product.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onRefresh={() => refetch()}
        refreshing={isFetching && !isPending}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerEyebrow}>MARKETPLACE</Text>
                <Text style={styles.headerTitle}>All Deals</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable style={styles.headerIconButton} onPress={() => navigation.navigate('Cart')} accessibilityLabel="Open cart">
                  <Text style={styles.headerIcon}>🛒</Text>
                </Pressable>
                <Pressable style={styles.avatarButton} onPress={() => navigation.navigate('Profile')} accessibilityLabel="Open account">
                  <Text style={styles.avatarIcon}>👤</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Pressable style={styles.searchGrow} onPress={() => navigation.navigate('Search')} accessibilityRole="button" accessibilityLabel="Open product search">
                <View pointerEvents="none"><SearchBar value="" onChangeText={() => undefined} /></View>
              </Pressable>
              <Pressable onPress={openFilters} style={[styles.squareFilter, hasActiveFilters && styles.squareFilterActive]} accessibilityLabel="Open filters">
                <Text style={[styles.squareFilterText, hasActiveFilters && styles.squareFilterTextActive]}>☷</Text>
              </Pressable>
            </View>

            {showAiEntry ? (
              <Pressable
                style={styles.aiEntryCard}
                onPress={() => navigation.navigate('AiAssistant')}
                accessibilityRole="button"
                accessibilityLabel="Open AI assistant"
              >
                <View style={styles.aiEntryLeft}>
                  <View style={styles.aiEntryBadge}>
                    <Text style={styles.aiEntrySparkle}>✨</Text>
                  </View>
                  <View style={styles.aiEntryTexts}>
                    <Text style={styles.aiEntryTitle}>AI assistant</Text>
                    <Text style={styles.aiEntrySubtitle}>Product Q&A and smart shopping suggestions</Text>
                  </View>
                </View>
                <Text style={styles.aiEntryArrow}>→</Text>
              </Pressable>
            ) : null}

            {products.length > 0 ? (
              <Pressable style={styles.heroCard} onPress={() => handleProductPress(products[0])}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>FEATURED DEAL</Text>
                  <Text style={styles.heroTitle} numberOfLines={2}>{products[0].name}</Text>
                  <Text style={styles.heroPrice}>{formatVND(products[0].price)}</Text>
                  <View style={styles.heroButton}><Text style={styles.heroButtonText}>Shop now  →</Text></View>
                </View>
                <ProductImage source={products[0].image} style={styles.heroImage} />
              </Pressable>
            ) : null}

            {vouchers.length > 0 ? (
              <View style={styles.vouchers}>
                <View style={styles.vouchersHeader}>
                  <Text style={styles.vouchersTitle}>Vouchers</Text>
                  <Pressable
                    style={styles.vouchersViewAll}
                    onPress={() => navigation.navigate('Vouchers')}
                    accessibilityRole="button"
                    accessibilityLabel="View all vouchers"
                  >
                    <Text style={styles.vouchersViewAllText}>View all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vouchersList}
                >
                  {vouchers.map((voucher) => (
                    <VoucherRow key={voucher.code} voucher={voucher} style={styles.voucherCard} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categories}
            >
              {categories.map((category) => {
                const isSelected = category.id === selectedCategoryId;
                const image = category.id === ALL_CATEGORY.id ? products[0]?.image : categoryImageByName.get(category.name);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => handleCategoryPress(category.id)}
                    style={styles.categoryItem}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.categoryVisual, isSelected && styles.categoryVisualSelected]}>
                      {image ? <ProductImage source={image} style={styles.categoryImage} /> : <Text style={[styles.categoryFallback, isSelected && styles.categoryFallbackSelected]}>{category.name.slice(0, 1).toUpperCase()}</Text>}
                    </View>
                    <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]} numberOfLines={1}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.toolbar}>
              {hasLoaded ? (
                <Text style={styles.resultCount}>
                  {totalElements} {totalElements === 1 ? 'product' : 'products'}
                </Text>
              ) : (
                <Text style={styles.resultCount}>Products unavailable</Text>
              )}
              <View style={styles.toolbarActions}>
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
            </View>
          </View>
        }
        ListEmptyComponent={
          isError ? (
            // A failed request is NOT an empty catalog: show the reason and a
            // retry action instead of an empty-state message.
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>⚠️</Text>
              <Text style={styles.stateTitle}>Couldn&apos;t load products</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>
              <Pressable
                onPress={() => refetch()}
                style={styles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Retry loading products"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : isPending ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>Loading products…</Text>
            </View>
          ) : (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>🔍</Text>
              <Text style={styles.stateTitle}>No products found</Text>
              <Text style={styles.stateText}>Try a different keyword or category.</Text>
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
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <Pressable onPress={() => setFilterVisible(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Price range</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceField}><Text style={styles.currency}>$</Text><TextInput value={minPrice} onChangeText={(text) => setMinPrice(text.replace(/[^0-9]/g, ''))} placeholder="10" keyboardType="numeric" style={styles.priceInput} /></View>
                <View style={styles.rangeLine} />
                <View style={styles.priceField}><Text style={styles.currency}>$</Text><TextInput value={maxPrice} onChangeText={(text) => setMaxPrice(text.replace(/[^0-9]/g, ''))} placeholder="1000" keyboardType="numeric" style={styles.priceInput} /></View>
              </View>
              <View style={styles.sliderTrack}><View style={styles.sliderActive} /><View style={[styles.sliderKnob, { left: '5%' }]} /><View style={[styles.sliderKnob, { left: '42%' }]} /></View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Average review</Text>
              <View style={styles.ratingFilterRow}>
                <Text style={styles.stars}>★ ★ ★ ★</Text><Text style={styles.starOff}>★</Text>
                <TextInput value={minRating} onChangeText={(text) => setMinRating(text.replace(/[^0-9.]/g, ''))} placeholder="4" keyboardType="decimal-pad" style={styles.ratingInput} />
                <Text style={styles.andUp}>& Up</Text>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Others</Text>
              <View style={styles.optionGrid}>
                <View style={[styles.optionCard, styles.optionCardActive]}><Text style={styles.optionIcon}>↔</Text><Text style={styles.optionTextActive}>30-day Free Return</Text></View>
                <View style={styles.optionCard}><Text style={styles.optionIconMuted}>▣</Text><Text style={styles.optionText}>Buyer Protection</Text></View>
                <View style={styles.optionCard}><Text style={styles.optionIconMuted}>◆</Text><Text style={styles.optionText}>Best Deal</Text></View>
                <View style={styles.optionCard}><Text style={styles.optionIconMuted}>⌖</Text><Text style={styles.optionText}>Ship to store</Text></View>
              </View>
            </View>
            {filterError ? <Text style={styles.modalError}>{filterError}</Text> : null}
            <View style={styles.modalActions}>
              <Button title="Clear" onPress={clearFilters} variant="secondary" style={styles.modalButton} />
              <Button title="Apply filters" onPress={applyFilters} variant="primary" style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  vouchers: {
    gap: spacing.xs,
  },
  vouchersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vouchersTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  vouchersViewAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  vouchersViewAllText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.primary,
  },
  vouchersList: {
    gap: spacing.sm,
  },
  voucherCard: {
    width: 280,
  },
  categories: {
    gap: 14,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  categoryItem: { width: 88, alignItems: 'center' },
  categoryVisual: {
    width: 76, height: 76, borderRadius: 22, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  categoryVisualSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: '#E8FAFC' },
  categoryImage: { width: '100%', height: '100%' },
  categoryFallback: { fontSize: 26, fontWeight: '800', color: colors.textSecondary },
  categoryFallbackSelected: { color: colors.primary },
  categoryLabel: { marginTop: 7, width: 88, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  categoryLabelSelected: { color: colors.primary, fontWeight: '700' },
  heroCard: {
    minHeight: 172,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: 18,
    backgroundColor: '#F3EEFF',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  heroCopy: { flex: 1, zIndex: 2 },
  heroEyebrow: { fontSize: 11, fontWeight: '800', color: colors.primary, letterSpacing: 1.2, marginBottom: 7 },
  heroTitle: { fontSize: 22, lineHeight: 27, fontWeight: '800', color: colors.text, maxWidth: 180 },
  heroPrice: { marginTop: 7, fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  heroButton: { alignSelf: 'flex-start', marginTop: 13, backgroundColor: '#171A21', borderRadius: 7, paddingHorizontal: 14, paddingVertical: 9 },
  heroButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  heroImage: { width: 132, height: 132, borderRadius: 16, marginLeft: 8 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  filterButtonTextActive: {
    color: colors.onPrimary,
    fontWeight: '600',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.base,
    color: colors.text,
  },
  modalError: {
    fontSize: typography.sm,
    color: colors.danger,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },

  headerEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: colors.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  headerIcon: { fontSize: 22, color: colors.text },
  avatarButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4E8FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  avatarIcon: {
    fontSize: 21,
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#7C3AED' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchGrow: { flex: 1 },
  squareFilter: { width: 44, height: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  squareFilterActive: { backgroundColor: '#E6FAFD', borderWidth: 1, borderColor: colors.primary },
  squareFilterText: { fontSize: 22, color: colors.textSecondary, transform: [{ rotate: '90deg' }] },
  squareFilterTextActive: { color: colors.primary },
  filterSheet: { width: '100%', backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: spacing.lg },
  filterHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  closeButton: { position: 'absolute', right: spacing.md, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 28, color: colors.textSecondary, fontWeight: '300' },
  filterSection: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  filterSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  priceField: { flex: 1, height: 42, borderWidth: 1, borderColor: '#B8C0CC', borderRadius: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  currency: { fontSize: 15, color: colors.textSecondary, marginRight: 5 },
  priceInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  rangeLine: { width: 18, height: 1, backgroundColor: colors.border },
  sliderTrack: { height: 4, borderRadius: 2, backgroundColor: '#B9EEF4', position: 'relative', marginVertical: 8 },
  sliderActive: { position: 'absolute', left: '5%', width: '38%', height: 4, borderRadius: 2, backgroundColor: colors.primary },
  sliderKnob: { position: 'absolute', top: -8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.primary },
  ratingFilterRow: { flexDirection: 'row', alignItems: 'center' },
  stars: { color: '#FBBF24', fontSize: 22, letterSpacing: 2 },
  starOff: { color: '#D5DAE1', fontSize: 22, marginLeft: 3 },
  ratingInput: { width: 32, marginLeft: spacing.sm, color: colors.text, fontSize: 14, textAlign: 'center' },
  andUp: { fontSize: 14, color: colors.text },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  optionCard: { width: '47%', minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 6 },
  optionCardActive: { borderColor: colors.primary, backgroundColor: '#F7FEFF' },
  optionIcon: { fontSize: 23, color: colors.primary },
  optionIconMuted: { fontSize: 22, color: '#98A2B3' },
  optionText: { fontSize: 12, color: '#98A2B3' },
  optionTextActive: { fontSize: 12, color: colors.primary },
  aiEntryCard: {
    marginTop: spacing.sm,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  aiEntryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiEntrySparkle: {
    fontSize: 16,
  },
  aiEntryTexts: {
    flex: 1,
  },
  aiEntryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  aiEntrySubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  aiEntryArrow: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});
