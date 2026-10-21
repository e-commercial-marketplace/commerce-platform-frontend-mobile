/**
 * Shopping cart screen backed by the shared CartContext.
 *
 * With items: header (count + Clear Cart), the list of CartItemRows with
 * quantity controls, and a pinned summary (subtotal + item count) above the
 * UI-only checkout button. Empty: an empty state whose "Continue Shopping"
 * returns to the Home tab.
 */

import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CartItemRow from '../components/CartItemRow';
import { colors, radii, spacing } from '../constants/theme';
import { useCart } from '../hooks/useCart';
import type { MainTabScreenProps } from '../navigation/types';
import { formatVND } from '../utils/format';

export default function CartScreen({ navigation }: MainTabScreenProps<'Cart'>) {
  const { items, totalItems, subtotal, increaseQuantity, decreaseQuantity, removeItem, clearCart } =
    useCart();

  const handleContinueShopping = () => navigation.navigate('Home');

  const handleCheckout = () => {
    // UI-only placeholder: checkout is implemented in a later milestone.
    Alert.alert('Checkout', 'Checkout will be implemented in a later feature.');
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Browse the catalog and add products you love.</Text>
          <Pressable
            onPress={handleContinueShopping}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
          >
            <Text style={styles.emptyButtonText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Cart</Text>
          <Text style={styles.headerSubtitle}>
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Pressable
          onPress={clearCart}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel="Clear cart"
        >
          <Text style={styles.clearText}>Clear Cart</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            onIncrease={() => increaseQuantity(item.product.id)}
            onDecrease={() => decreaseQuantity(item.product.id)}
            onRemove={() => removeItem(item.product.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatVND(subtotal)}</Text>
        </View>
        <Text style={styles.summaryCaption}>
          {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
        </Text>
        <Pressable
          onPress={handleCheckout}
          style={({ pressed }) => [styles.checkoutButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
        >
          <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  // Item list
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  // Summary + checkout footer
  summary: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  summaryCaption: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
