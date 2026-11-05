/**
 * Search / Discovery screen - fast product lookup with instant UI & debounced API.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PriceDisplay from '../components/PriceDisplay';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import { colors, radii, spacing } from '../constants/theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCategories, useProductList } from '../hooks/useProducts';
import { useAppLanguage } from '../i18n';
import type { MainTabScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { Product } from '../types/product';

const PAGE_SIZE = 20;

export default function SearchScreen({ navigation }: MainTabScreenProps<'Search'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const inputRef = useRef<TextInputInstance>(null);
  const [query, setQuery] = useState('');
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  // Page is tied to the keyword + category pair: when this pair changes, `page` goes back to 0 within
  // the same render, so a new keyword is never sent with an old page number.
  const searchScope = `${debouncedQuery}|${selectedCategoryId}`;
  const [pageState, setPageState] = useState({ scope: searchScope, page: 0 });
  const page = pageState.scope === searchScope ? pageState.page : 0;

  const { data: categoriesData } = useCategories();
  const categories = useMemo(
    () => [{ id: 'all', name: 'All' }, ...(categoriesData ?? [])],
    [categoriesData],
  );

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
      page,
      size: PAGE_SIZE,
    }),
    [debouncedQuery, selectedCategoryId, page],
  );
  const { data, isPending, isError, refetch } = useProductList(filters);
  const allFetchedProducts = data?.products ?? [];
  const products = debouncedQuery ? allFetchedProducts : [];
  const totalPages = data?.totalPages ?? 0;
  const categoryImageByName = useMemo(() => {
    const map = new Map<string, Product['image']>();
    for (const product of allFetchedProducts) {
      if (!map.has(product.category)) map.set(product.category, product.image);
    }
    return map;
  }, [allFetchedProducts]);

  function goToPreviousPage() {
    if (page > 0) {
      setPageState({ scope: searchScope, page: page - 1 });
    }
  }

  function goToNextPage() {
    if (totalPages > 0 && page < totalPages - 1) {
      setPageState({ scope: searchScope, page: page + 1 });
    }
  }

  function rememberKeyword(value: string) {
    const keyword = value.trim();
    if (!keyword) return;
    setRecentKeywords((current) =>
      [
        keyword,
        ...current.filter((item) => item.toLowerCase() !== keyword.toLowerCase()),
      ].slice(0, 8),
    );
  }

  function submitSearch() {
    rememberKeyword(query);
    Keyboard.dismiss();
  }

  function openProduct(product: Product) {
    rememberKeyword(query);
    setRecentProducts((current) =>
      [product, ...current.filter((item) => item.id !== product.id)].slice(0, 6),
    );
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="search-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('catalog.searchTitle', 'Search')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t('catalog.searchSubtitle', 'Find products quickly')}
        </Text>
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.searchIcon, { color: theme.text }]}>⌕</Text>
        <TextInput
          ref={inputRef}
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          placeholder={t('catalog.searchPlaceholder', 'Search for product')}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { color: theme.text }]}
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            style={[styles.clearCircle, { backgroundColor: theme.surfaceAlt }]}
          >
            <Text style={[styles.clearText, { color: theme.textSecondary }]}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.categorySection}>
        <Text style={[styles.categoryTitle, { color: theme.text }]}>
          {t('catalog.categories', 'Categories')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((category) => {
            const selected = selectedCategoryId === category.id;
            const image =
              category.id === 'all'
                ? allFetchedProducts[0]?.image
                : categoryImageByName.get(category.name);
            const categoryDisplayName =
              category.id === 'all' ? t('catalog.allCategory', 'All') : category.name;
            return (
              <Pressable
                key={category.id}
                style={styles.categoryItem}
                onPress={() => setSelectedCategoryId(category.id)}
              >
                <View
                  style={[
                    styles.categoryVisual,
                    {
                      backgroundColor: theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                      borderWidth: selected ? 2 : 1,
                    },
                    selected && { backgroundColor: theme.surfaceAlt },
                  ]}
                >
                  {image ? (
                    <ProductImage source={image} style={styles.categoryImage} />
                  ) : (
                    <Text
                      style={[
                        styles.categoryFallback,
                        { color: selected ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {categoryDisplayName.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: selected ? theme.primary : theme.textSecondary },
                    selected && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {categoryDisplayName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!debouncedQuery ? (
        <ScrollView contentContainerStyle={styles.discovery} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('catalog.recentSearches', 'Recent searches')}
            </Text>
            {recentKeywords.length > 0 ? (
              <Pressable onPress={() => setRecentKeywords([])}>
                <Text style={[styles.clearAction, { color: theme.primary }]}>
                  {t('catalog.clearAll', 'Clear all')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {recentKeywords.length === 0 ? (
            <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
              {t('catalog.noRecentSearches', 'Your recent keywords will appear here.')}
            </Text>
          ) : (
            <View style={styles.keywordWrap}>
              {recentKeywords.map((keyword) => (
                <Pressable
                  key={keyword}
                  style={[
                    styles.keywordChip,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={() => setQuery(keyword)}
                >
                  <Text style={[styles.historyIcon, { color: theme.textSecondary }]}>↶</Text>
                  <Text style={[styles.keywordText, { color: theme.text }]}>{keyword}</Text>
                  <Pressable
                    onPress={() =>
                      setRecentKeywords((items) => items.filter((item) => item !== keyword))
                    }
                    hitSlop={8}
                  >
                    <Text style={[styles.keywordRemove, { color: theme.textSecondary }]}>×</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.sectionHeader, styles.productsHeader]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('catalog.recentlyViewed', 'Recently viewed')}
            </Text>
            {recentProducts.length > 0 ? (
              <Pressable onPress={() => setRecentProducts([])}>
                <Text style={[styles.clearAction, { color: theme.primary }]}>
                  {t('catalog.clear', 'Clear')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {recentProducts.length === 0 ? (
            <View
              style={[
                styles.recentEmpty,
                { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.recentEmptyIcon, { color: theme.textSecondary }]}>⌕</Text>
              <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
                {t(
                  'catalog.recentlyViewedEmpty',
                  'Products opened from search will be kept here.',
                )}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recentProducts.map((product) => (
                <Pressable
                  key={product.id}
                  style={[
                    styles.recentCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                  onPress={() => openProduct(product)}
                >
                  <ProductImage source={product.image} style={styles.recentImage} />
                  <View style={styles.recentBody}>
                    <Text
                      style={[styles.recentName, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                    <Text style={styles.recentRating}>
                      ★ {product.rating.toFixed(1)}{' '}
                      <Text style={[styles.recentReviews, { color: theme.textSecondary }]}>
                        {t('catalog.reviewsCount', `(${product.reviewCount} reviews)`, {
                          count: product.reviewCount,
                        })}
                      </Text>
                    </Text>
                    <PriceDisplay
                      price={product.price}
                      originalPrice={product.originalPrice}
                      size="sm"
                    />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      ) : isPending ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
            {t('catalog.searching', 'Searching…')}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('catalog.searchError', "Couldn't search products")}
          </Text>
          <Pressable
            style={[styles.retry, { backgroundColor: theme.primary }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>{t('catalog.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard product={item} viewMode="grid" onPress={openProduct} />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>
              {t(
                'catalog.searchResults',
                `${data?.totalElements ?? products.length} results for “${query.trim()}”`,
                {
                  count: data?.totalElements ?? products.length,
                  query: query.trim(),
                },
              )}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {t('catalog.noProductsFound', 'No products found')}
              </Text>
              <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
                {t('catalog.tryAnotherKeyword', 'Try another keyword.')}
              </Text>
            </View>
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
                      {
                        backgroundColor: isDark ? theme.border : theme.surface,
                        borderColor: theme.border,
                      },
                    ],
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.previousPage', 'Previous page')}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      { color: theme.onPrimary },
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
                      {
                        backgroundColor: isDark ? theme.border : theme.surface,
                        borderColor: theme.border,
                      },
                    ],
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('catalog.nextPage', 'Next page')}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      { color: theme.onPrimary },
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 3, fontSize: 13 },
  searchBox: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  searchIcon: { fontSize: 23, marginRight: 10 },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clearCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: { fontSize: 20, lineHeight: 22 },
  categorySection: { paddingTop: 6, paddingBottom: 10 },
  categoryTitle: {
    paddingHorizontal: spacing.md,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  categoryRow: { paddingHorizontal: spacing.md, gap: 14 },
  categoryItem: { width: 82, alignItems: 'center' },
  categoryVisual: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImage: { width: '100%', height: '100%' },
  categoryFallback: { fontSize: 24, fontWeight: '800' },
  categoryLabel: {
    marginTop: 7,
    width: 82,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  discovery: { padding: spacing.md, paddingTop: 10, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  clearAction: { fontSize: 13, fontWeight: '600' },
  keywordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  historyIcon: { fontSize: 15 },
  keywordText: { fontSize: 14 },
  keywordRemove: { fontSize: 18 },
  productsHeader: { marginTop: 30 },
  recentEmpty: {
    minHeight: 120,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: 8,
  },
  recentEmptyIcon: { fontSize: 32 },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  recentRow: { gap: spacing.sm, paddingRight: spacing.md },
  recentCard: {
    width: 270,
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  recentImage: { width: 92, height: 92, borderRadius: radii.sm },
  recentBody: { flex: 1, minWidth: 0, gap: 5 },
  recentName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  recentRating: { fontSize: 12, color: '#FBBF24', fontWeight: '700' },
  recentReviews: { fontWeight: '400' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  errorTitle: { fontSize: 16, fontWeight: '700' },
  retry: { borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  results: { padding: spacing.md, paddingBottom: 36, gap: spacing.sm },
  gridRow: { gap: spacing.sm },
  resultLabel: { marginBottom: spacing.md, fontSize: 14, color: colors.textSecondary },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.md },
  pageButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radii.sm },
  pageButtonDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pageButtonText: { color: colors.onPrimary, fontWeight: '600' },
  pageButtonTextDisabled: { color: colors.textSecondary },
  pageInfo: { fontSize: 13, color: colors.textSecondary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
});
