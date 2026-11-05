/**
 * Home / Product Catalog: powered by the real backend API.
 *
 * Server state comes from TanStack Query (`useProductList` /
 * `useCategories`); the screen owns only UI state (search text, selected
 * category, layout mode, current page).
 *
 * Fully theme-aware and localized with semantic tokens for Dark/Light mode.
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
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCategories, useProductList } from '../hooks/useProducts';
import { useUsableVouchers } from '../hooks/useVoucher';
import { useAppLanguage } from '../i18n';
import type { MainTabScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
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
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
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
      setFilterError(t('catalog.minPriceError', 'Minimum price must be 0 or more.'));
      return;
    }
    if (maxPrice.trim() !== '' && (Number.isNaN(maxPriceNum) || (maxPriceNum as number) < 0)) {
      setFilterError(t('catalog.maxPriceError', 'Maximum price must be 0 or more.'));
      return;
    }
    if (
      minPriceNum !== undefined &&
      maxPriceNum !== undefined &&
      (maxPriceNum as number) < (minPriceNum as number)
    ) {
      setFilterError(
        t('catalog.priceRangeError', 'Maximum price must not be less than minimum price.'),
      );
      return;
    }
    if (minRating.trim() !== '') {
      if (
        Number.isNaN(minRatingNum) ||
        (minRatingNum as number) < 0 ||
        (minRatingNum as number) > 5
      ) {
        setFilterError(t('catalog.ratingRangeError', 'Minimum rating must be between 0 and 5.'));
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
    appliedMinPrice !== undefined ||
    appliedMaxPrice !== undefined ||
    appliedMinRating !== undefined;

  function renderProduct({ item }: ListRenderItemInfo<Product>) {
    return <ProductCard product={item} viewMode={viewMode} onPress={handleProductPress} />;
  }

  // First load: nothing has been received yet - show a real loading state
  // instead of an empty list that looks like "0 products".
  if (isPending && !hasLoaded) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="home-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('catalog.loadingProducts', 'Loading products…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const errorMessage =
    error instanceof Error ? error.message : t('catalog.couldNotLoad', 'Failed to load products. Please try again.');

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="home-screen"
    >
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
        refreshing={Boolean(isFetching && !isPending)}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View>
                <Text style={[styles.headerEyebrow, { color: theme.primary }]}>
                  {t('catalog.eyebrow', 'MARKETPLACE')}
                </Text>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {t('catalog.allDeals', 'All Deals')}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={[
                    styles.headerIconButton,
                    { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                  ]}
                  onPress={() => navigation.navigate('Cart')}
                  accessibilityLabel={t('catalog.openCart', 'Open cart')}
                >
                  <Text style={[styles.headerIcon, { color: theme.text }]}>🛒</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.avatarButton,
                    { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                  ]}
                  onPress={() => navigation.navigate('Profile')}
                  accessibilityLabel={t('catalog.openAccount', 'Open account')}
                >
                  <Text style={styles.avatarIcon}>👤</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchGrow}
                onPress={() => navigation.navigate('Search')}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.openProductSearch', 'Open product search')}
              >
                <View pointerEvents="none">
                  <SearchBar value="" onChangeText={() => undefined} />
                </View>
              </Pressable>
              <Pressable
                onPress={openFilters}
                style={[
                  styles.squareFilter,
                  { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
                  hasActiveFilters && {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.primary,
                  },
                ]}
                accessibilityLabel={t('catalog.openFilters', 'Open filters')}
              >
                <Text
                  style={[
                    styles.squareFilterText,
                    { color: hasActiveFilters ? theme.primary : theme.textSecondary },
                  ]}
                >
                  ☷
                </Text>
              </Pressable>
            </View>

            {showAiEntry ? (
              <Pressable
                style={[
                  styles.aiEntryCard,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.primary,
                  },
                ]}
                onPress={() => navigation.navigate('AiAssistant')}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.aiAssistantA11y', 'Mở trợ lý AI')}
              >
                <View style={styles.aiEntryLeft}>
                  <View style={[styles.aiEntryBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={styles.aiEntrySparkle}>✨</Text>
                  </View>
                  <View style={styles.aiEntryTexts}>
                    <Text style={[styles.aiEntryTitle, { color: theme.text }]}>
                      {t('catalog.aiAssistant', 'Trợ lý AI')}
                    </Text>
                    <Text style={[styles.aiEntrySubtitle, { color: theme.textSecondary }]}>
                      {t(
                        'catalog.aiAssistantSubtitle',
                        'Hỏi đáp sản phẩm & gợi ý mua sắm thông minh',
                      )}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.aiEntryArrow, { color: theme.primary }]}>→</Text>
              </Pressable>
            ) : null}

            {products.length > 0 ? (
              <Pressable
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleProductPress(products[0])}
              >
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroEyebrow, { color: theme.primary }]}>
                    {t('catalog.featuredDeal', 'FEATURED DEAL')}
                  </Text>
                  <Text
                    style={[styles.heroTitle, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {products[0].name}
                  </Text>
                  <Text style={[styles.heroPrice, { color: theme.textSecondary }]}>
                    {formatVND(products[0].price)}
                  </Text>
                  <View style={[styles.heroButton, { backgroundColor: theme.primary }]}>
                    <Text style={styles.heroButtonText}>
                      {t('catalog.shopNow', 'Shop now  →')}
                    </Text>
                  </View>
                </View>
                <ProductImage source={products[0].image} style={styles.heroImage} />
              </Pressable>
            ) : null}

            {vouchers.length > 0 ? (
              <View style={styles.vouchers}>
                <View style={styles.vouchersHeader}>
                  <Text style={[styles.vouchersTitle, { color: theme.text }]}>
                    {t('catalog.vouchers', 'Vouchers')}
                  </Text>
                  <Pressable
                    style={styles.vouchersViewAll}
                    onPress={() => navigation.navigate('Vouchers')}
                    accessibilityRole="button"
                    accessibilityLabel={t('catalog.viewAllVouchers', 'View all vouchers')}
                  >
                    <Text style={[styles.vouchersViewAllText, { color: theme.primary }]}>
                      {t('catalog.viewAll', 'View all')}
                    </Text>
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
                const image =
                  category.id === ALL_CATEGORY.id
                    ? products[0]?.image
                    : categoryImageByName.get(category.name);
                const categoryDisplayName =
                  category.id === ALL_CATEGORY.id
                    ? t('catalog.allCategory', 'All')
                    : category.name;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => handleCategoryPress(category.id)}
                    style={styles.categoryItem}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.categoryVisual,
                        {
                          backgroundColor: theme.surface,
                          borderColor: isSelected ? theme.primary : theme.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    >
                      {image ? (
                        <ProductImage source={image} style={styles.categoryImage} />
                      ) : (
                        <Text
                          style={[
                            styles.categoryFallback,
                            { color: isSelected ? theme.primary : theme.textSecondary },
                          ]}
                        >
                          {categoryDisplayName.slice(0, 1).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        { color: isSelected ? theme.primary : theme.textSecondary },
                        isSelected && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {categoryDisplayName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.toolbar}>
              {hasLoaded ? (
                <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
                  {totalElements === 1
                    ? t('catalog.productCount_one', '1 product')
                    : t('catalog.productCount_other', `${totalElements} products`, {
                        count: totalElements,
                      })}
                </Text>
              ) : (
                <Text style={[styles.resultCount, { color: theme.textSecondary }]}>
                  {t('catalog.productsUnavailable', 'Products unavailable')}
                </Text>
              )}
              <View style={styles.toolbarActions}>
                <View
                  style={[
                    styles.viewToggle,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
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
            </View>
          </View>
        }
        ListEmptyComponent={
          isError ? (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>⚠️</Text>
              <Text style={[styles.stateTitle, { color: theme.text }]}>
                {t('catalog.couldNotLoad', "Couldn't load products")}
              </Text>
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {errorMessage}
              </Text>
              <Pressable
                onPress={() => refetch()}
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.retryLoadingProducts', 'Retry loading products')}
              >
                <Text style={styles.retryButtonText}>{t('catalog.retry', 'Retry')}</Text>
              </Pressable>
            </View>
          ) : isPending ? (
            <View style={styles.stateBlock}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('catalog.loadingProducts', 'Loading products…')}
              </Text>
            </View>
          ) : (
            <View style={styles.stateBlock}>
              <Text style={styles.stateIcon}>🔍</Text>
              <Text style={[styles.stateTitle, { color: theme.text }]}>
                {t('catalog.noProductsFound', 'No products found')}
              </Text>
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t(
                  'catalog.noProductsFoundHint',
                  'Try a different keyword or category.',
                )}
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
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.filterSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={[styles.filterHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('catalog.filter', 'Filter')}
              </Text>
              <Pressable onPress={() => setFilterVisible(false)} style={styles.closeButton}>
                <Text style={[styles.closeText, { color: theme.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                {t('catalog.priceRange', 'Price range')}
              </Text>
              <View style={styles.priceRow}>
                <View
                  style={[
                    styles.priceField,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.currency, { color: theme.textSecondary }]}>đ</Text>
                  <TextInput
                    value={minPrice}
                    onChangeText={(text) => setMinPrice(text.replace(/[^0-9]/g, ''))}
                    placeholder="10000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.priceInput, { color: theme.text }]}
                  />
                </View>
                <View style={[styles.rangeLine, { backgroundColor: theme.border }]} />
                <View
                  style={[
                    styles.priceField,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.currency, { color: theme.textSecondary }]}>đ</Text>
                  <TextInput
                    value={maxPrice}
                    onChangeText={(text) => setMaxPrice(text.replace(/[^0-9]/g, ''))}
                    placeholder="1000000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.priceInput, { color: theme.text }]}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                {t('catalog.averageReview', 'Average review')}
              </Text>
              <View style={styles.ratingFilterRow}>
                <Text style={styles.stars}>★ ★ ★ ★</Text>
                <Text style={styles.starOff}>★</Text>
                <TextInput
                  value={minRating}
                  onChangeText={(text) => setMinRating(text.replace(/[^0-9.]/g, ''))}
                  placeholder="4"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  style={[styles.ratingInput, { color: theme.text }]}
                />
                <Text style={[styles.andUp, { color: theme.text }]}>
                  {t('catalog.andUp', '& Up')}
                </Text>
              </View>
            </View>

            <View style={[styles.filterSection, { borderBottomColor: theme.border }]}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>
                {t('catalog.others', 'Others')}
              </Text>
              <View style={styles.optionGrid}>
                <View
                  style={[
                    styles.optionCard,
                    styles.optionCardActive,
                    { borderColor: theme.primary, backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  <Text style={[styles.optionIcon, { color: theme.primary }]}>↔</Text>
                  <Text style={[styles.optionTextActive, { color: theme.primary }]}>
                    {t('catalog.freeReturn', '30-day Free Return')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.optionCard,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.optionIconMuted, { color: theme.textSecondary }]}>▣</Text>
                  <Text style={[styles.optionText, { color: theme.textSecondary }]}>
                    {t('catalog.buyerProtection', 'Buyer Protection')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.optionCard,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.optionIconMuted, { color: theme.textSecondary }]}>◆</Text>
                  <Text style={[styles.optionText, { color: theme.textSecondary }]}>
                    {t('catalog.bestDeal', 'Best Deal')}
                  </Text>
                </View>
                <View
                  style={[
                    styles.optionCard,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.optionIconMuted, { color: theme.textSecondary }]}>⌖</Text>
                  <Text style={[styles.optionText, { color: theme.textSecondary }]}>
                    {t('catalog.shipToStore', 'Ship to store')}
                  </Text>
                </View>
              </View>
            </View>
            {filterError ? (
              <Text style={[styles.modalError, { color: theme.danger }]}>{filterError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                title={t('catalog.clear', 'Clear')}
                onPress={clearFilters}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title={t('catalog.applyFilters', 'Apply filters')}
                onPress={applyFilters}
                variant="primary"
                style={styles.modalButton}
              />
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
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
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
  },
  vouchersViewAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  vouchersViewAllText: {
    fontSize: typography.md,
    fontWeight: '600',
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
  categoryItem: {
    width: 88,
    alignItems: 'center',
  },
  categoryVisual: {
    width: 76,
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryFallback: {
    fontSize: 26,
    fontWeight: '800',
  },
  categoryLabel: {
    marginTop: 7,
    width: 88,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  heroCard: {
    minHeight: 172,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    zIndex: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    maxWidth: 180,
  },
  heroPrice: {
    marginTop: 7,
    fontSize: 16,
    fontWeight: '700',
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 13,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroImage: {
    width: 132,
    height: 132,
    borderRadius: 16,
    marginLeft: 8,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingBottom: spacing.lg,
  },
  filterHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 28,
    fontWeight: '300',
  },
  filterSection: {
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  priceField: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  currency: {
    fontSize: 15,
    marginRight: 5,
  },
  priceInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  rangeLine: {
    width: 18,
    height: 1,
  },
  ratingFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    color: '#FBBF24',
    fontSize: 22,
    letterSpacing: 2,
  },
  starOff: {
    color: '#94A3B8',
    fontSize: 22,
    marginLeft: 3,
  },
  ratingInput: {
    width: 36,
    marginLeft: spacing.sm,
    fontSize: 14,
    textAlign: 'center',
  },
  andUp: {
    fontSize: 14,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  optionCard: {
    width: '47%',
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 4,
  },
  optionCardActive: {
    borderWidth: 1.5,
  },
  optionIcon: {
    fontSize: 22,
  },
  optionIconMuted: {
    fontSize: 22,
  },
  optionText: {
    fontSize: 12,
  },
  optionTextActive: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalError: {
    fontSize: typography.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarIcon: {
    fontSize: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchGrow: {
    flex: 1,
  },
  squareFilter: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareFilterText: {
    fontSize: 22,
    transform: [{ rotate: '90deg' }],
  },
  aiEntryCard: {
    marginTop: spacing.sm,
    borderWidth: 1,
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
  },
  aiEntrySubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  aiEntryArrow: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
});
