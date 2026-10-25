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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import PriceDisplay from '../components/PriceDisplay';
import { colors, radii, spacing } from '../constants/theme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useCategories, useProductList } from '../hooks/useProducts';
import type { MainTabScreenProps } from '../navigation/types';
import type { Product } from '../types/product';

const PAGE_SIZE = 20;

export default function SearchScreen({ navigation }: MainTabScreenProps<'Search'>) {
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const { data: categoriesData } = useCategories();
  const categories = useMemo(() => [{ id: 'all', name: 'All' }, ...(categoriesData ?? [])], [categoriesData]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      categoryId: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
      page: 0,
      size: PAGE_SIZE,
    }),
    [debouncedQuery, selectedCategoryId],
  );
  const { data, isPending, isError, refetch } = useProductList(filters);
  const allFetchedProducts = data?.products ?? [];
  const products = debouncedQuery ? allFetchedProducts : [];
  const categoryImageByName = useMemo(() => {
    const map = new Map<string, Product['image']>();
    for (const product of allFetchedProducts) {
      if (!map.has(product.category)) map.set(product.category, product.image);
    }
    return map;
  }, [allFetchedProducts]);

  function rememberKeyword(value: string) {
    const keyword = value.trim();
    if (!keyword) return;
    setRecentKeywords((current) => [keyword, ...current.filter((item) => item.toLowerCase() !== keyword.toLowerCase())].slice(0, 8));
  }

  function submitSearch() {
    rememberKeyword(query);
    Keyboard.dismiss();
  }

  function openProduct(product: Product) {
    rememberKeyword(query);
    setRecentProducts((current) => [product, ...current.filter((item) => item.id !== product.id)].slice(0, 6));
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>Find products quickly</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          ref={inputRef}
          autoFocus
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={submitSearch}
          placeholder="Search for product"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.clearCircle}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow} keyboardShouldPersistTaps="handled">
          {categories.map((category) => {
            const selected = selectedCategoryId === category.id;
            const image = category.id === 'all' ? allFetchedProducts[0]?.image : categoryImageByName.get(category.name);
            return (
              <Pressable key={category.id} style={styles.categoryItem} onPress={() => setSelectedCategoryId(category.id)}>
                <View style={[styles.categoryVisual, selected && styles.categoryVisualSelected]}>
                  {image ? <ProductImage source={image} style={styles.categoryImage} /> : <Text style={[styles.categoryFallback, selected && styles.categoryFallbackSelected]}>{category.name.slice(0, 1).toUpperCase()}</Text>}
                </View>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]} numberOfLines={1}>{category.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {!debouncedQuery ? (
        <ScrollView contentContainerStyle={styles.discovery} keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            {recentKeywords.length > 0 ? <Pressable onPress={() => setRecentKeywords([])}><Text style={styles.clearAction}>Clear all</Text></Pressable> : null}
          </View>
          {recentKeywords.length === 0 ? (
            <Text style={styles.emptyHint}>Your recent keywords will appear here.</Text>
          ) : (
            <View style={styles.keywordWrap}>
              {recentKeywords.map((keyword) => (
                <Pressable key={keyword} style={styles.keywordChip} onPress={() => setQuery(keyword)}>
                  <Text style={styles.historyIcon}>↶</Text><Text style={styles.keywordText}>{keyword}</Text>
                  <Pressable onPress={() => setRecentKeywords((items) => items.filter((item) => item !== keyword))} hitSlop={8}>
                    <Text style={styles.keywordRemove}>×</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.sectionHeader, styles.productsHeader]}>
            <Text style={styles.sectionTitle}>Recently viewed</Text>
            {recentProducts.length > 0 ? <Pressable onPress={() => setRecentProducts([])}><Text style={styles.clearAction}>Clear</Text></Pressable> : null}
          </View>
          {recentProducts.length === 0 ? (
            <View style={styles.recentEmpty}><Text style={styles.recentEmptyIcon}>⌕</Text><Text style={styles.emptyHint}>Products opened from search will be kept here.</Text></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
              {recentProducts.map((product) => (
                <Pressable key={product.id} style={styles.recentCard} onPress={() => openProduct(product)}>
                  <ProductImage source={product.image} style={styles.recentImage} />
                  <View style={styles.recentBody}>
                    <Text style={styles.recentName} numberOfLines={2}>{product.name}</Text>
                    <Text style={styles.recentRating}>★ {product.rating.toFixed(1)} <Text style={styles.recentReviews}>({product.reviewCount} reviews)</Text></Text>
                    <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      ) : isPending ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.emptyHint}>Searching…</Text></View>
      ) : isError ? (
        <View style={styles.center}><Text style={styles.errorTitle}>Couldn&apos;t search products</Text><Pressable style={styles.retry} onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></Pressable></View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductCard product={item} viewMode="grid" onPress={openProduct} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={<Text style={styles.resultLabel}>{data?.totalElements ?? products.length} results for “{query.trim()}”</Text>}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyTitle}>No products found</Text><Text style={styles.emptyHint}>Try another keyword.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { marginTop: 3, fontSize: 13, color: colors.textSecondary },
  searchBox: { marginHorizontal: spacing.md, marginVertical: spacing.sm, height: 52, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  searchIcon: { fontSize: 23, color: colors.text, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  clearCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8EBF0', alignItems: 'center', justifyContent: 'center' },
  clearText: { color: colors.textSecondary, fontSize: 20, lineHeight: 22 },
  categorySection: { paddingTop: 6, paddingBottom: 10 },
  categoryTitle: { paddingHorizontal: spacing.md, marginBottom: 10, fontSize: 16, fontWeight: '700', color: colors.text },
  categoryRow: { paddingHorizontal: spacing.md, gap: 14 },
  categoryItem: { width: 82, alignItems: 'center' },
  categoryVisual: { width: 68, height: 68, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  categoryVisualSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: '#E8FAFC' },
  categoryImage: { width: '100%', height: '100%' },
  categoryFallback: { fontSize: 24, fontWeight: '800', color: colors.textSecondary },
  categoryFallbackSelected: { color: colors.primary },
  categoryLabel: { marginTop: 7, width: 82, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  categoryLabelSelected: { color: colors.primary, fontWeight: '700' },
  discovery: { padding: spacing.md, paddingTop: 10, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  clearAction: { fontSize: 13, fontWeight: '600', color: colors.primary },
  keywordWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  keywordChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 9 },
  historyIcon: { color: colors.textSecondary, fontSize: 15 },
  keywordText: { color: colors.text, fontSize: 14 },
  keywordRemove: { color: colors.textSecondary, fontSize: 18 },
  productsHeader: { marginTop: 30 },
  recentEmpty: { minHeight: 120, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 8 },
  recentEmptyIcon: { fontSize: 32, color: colors.textSecondary },
  emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  recentRow: { gap: spacing.sm, paddingRight: spacing.md },
  recentCard: { width: 270, minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  recentImage: { width: 92, height: 92, borderRadius: radii.sm },
  recentBody: { flex: 1, minWidth: 0, gap: 5 },
  recentName: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.text },
  recentRating: { fontSize: 12, color: colors.star, fontWeight: '700' },
  recentReviews: { color: colors.textSecondary, fontWeight: '400' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.danger },
  retry: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  results: { padding: spacing.md, paddingBottom: 36, gap: spacing.sm },
  gridRow: { gap: spacing.sm },
  resultLabel: { marginBottom: spacing.md, fontSize: 14, color: colors.textSecondary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
});
