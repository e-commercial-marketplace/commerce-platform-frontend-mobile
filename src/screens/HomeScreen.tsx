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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProductCard, { type ProductViewMode } from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import { colors, radii, spacing } from '../constants/theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCategories, useProductList } from '../hooks/useProducts';
import type { MainTabScreenProps } from '../navigation/types';
import type { Product } from '../types/product';

/** Local "no category filter" option; not a backend category. */
const ALL_CATEGORY = { id: 'all', name: 'All' };

/** Page size sent to the backend (its own default is 20, max 100). */
const PAGE_SIZE = 20;

/** Debounce for the search field so one request is not fired per keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

export default function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ProductViewMode>('grid');
  const [page, setPage] = useState(0);

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
    } = { page, size: PAGE_SIZE };

    const q = debouncedQuery.trim();
    if (q.length > 0) {
      next.q = q;
    }
    if (selectedCategoryId !== ALL_CATEGORY.id) {
      next.categoryId = selectedCategoryId;
    }
    return next;
  }, [debouncedQuery, selectedCategoryId, page]);

  const { data, isPending, isError, error, refetch, isFetching } = useProductList(filters);

  const products = data?.products ?? [];
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
              <Text style={styles.headerTitle}>E-Commerce Marketplace</Text>
              <Text style={styles.headerSubtitle}>Discover products you will love</Text>
            </View>

            <SearchBar value={searchQuery} onChangeText={handleSearchChange} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categories}
            >
              {categories.map((category) => {
                const isSelected = category.id === selectedCategoryId;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => handleCategoryPress(category.id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {category.name}
                    </Text>
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
          ) : null
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  categories: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textSecondary,
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
});
