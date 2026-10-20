/**
 * Home / Product Catalog: mock product browsing with local search, local
 * category filtering and Grid/List layouts. Tapping a product opens the
 * ProductDetail route on the root stack.
 */

import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProductCard, { type ProductViewMode } from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import { colors, radii, spacing } from '../constants/theme';
import { getAllCategories, MOCK_PRODUCTS } from '../data/mockProducts';
import type { MainTabScreenProps } from '../navigation/types';
import type { Product } from '../types/product';

/** Sentinel shown as the first category chip; not part of the mock data. */
const ALL_CATEGORIES = 'All';

export default function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [viewMode, setViewMode] = useState<ProductViewMode>('grid');

  const categories = useMemo(() => [ALL_CATEGORIES, ...getAllCategories()], []);

  // Search and category filter are applied together in one pass so both
  // layouts always render the same, already-filtered list.
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return MOCK_PRODUCTS.filter((product) => {
      const matchesCategory = selectedCategory === ALL_CATEGORIES || product.category === selectedCategory;
      const matchesQuery = query.length === 0 || product.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  function handleProductPress(product: Product) {
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  function renderProduct({ item }: ListRenderItemInfo<Product>) {
    return <ProductCard product={item} viewMode={viewMode} onPress={handleProductPress} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        // Remounting on layout change is the supported way to switch
        // numColumns on a FlatList.
        key={viewMode}
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(product) => product.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>E-Commerce Marketplace</Text>
              <Text style={styles.headerSubtitle}>Discover products you will love</Text>
            </View>

            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categories}
            >
              {categories.map((category) => {
                const isSelected = category === selectedCategory;
                return (
                  <Pressable
                    key={category}
                    onPress={() => setSelectedCategory(category)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{category}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.toolbar}>
              <Text style={styles.resultCount}>
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              </Text>
              <View style={styles.viewToggle}>
                <Pressable
                  onPress={() => setViewMode('grid')}
                  style={[styles.toggleButton, viewMode === 'grid' && styles.toggleButtonActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'grid' }}
                >
                  <Text style={[styles.toggleText, viewMode === 'grid' && styles.toggleTextActive]}>Grid</Text>
                </Pressable>
                <Pressable
                  onPress={() => setViewMode('list')}
                  style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: viewMode === 'list' }}
                >
                  <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>Try a different keyword or category.</Text>
          </View>
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
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
