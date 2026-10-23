/**
 * Shopping cart screen backed by the real Cart API (via `useCart`).
 *
 * Customer states:
 * - loading      -> spinner;
 * - error        -> backend/normalized message + Retry;
 * - empty        -> empty state whose "Continue Shopping" returns to Home;
 * - items        -> server cart lines + backend subtotal + item count.
 *
 * Guests get a sign-in prompt (no guest server cart exists); sellers/admins
 * are told the cart is customer-only and no cart request is made for them.
 *
 * Checkout stays a UI-only placeholder: it belongs to a later feature.
 */

import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import CartItemRow from '../components/CartItemRow';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import type { MainTabScreenProps } from '../navigation/types';
import { formatVND } from '../utils/format';

export default function CartScreen({ navigation }: MainTabScreenProps<'Cart'>) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  const {
    items,
    totalItems,
    subtotal,
    isLoading,
    isError,
    error,
    refetch,
    isCustomer,
    isMutating,
    isClearing,
    pendingItemId,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
  } = useCart();

  const handleContinueShopping = () => navigation.navigate('Home');
  const handleLogin = () => navigation.navigate('Login');

  const handleCheckout = () => {
    // UI-only placeholder: checkout is implemented in a later milestone.
    Alert.alert('Checkout', 'Checkout will be implemented in a later feature.');
  };

  /** Runs a cart action and surfaces the normalized backend message. */
  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (actionError) {
      Alert.alert('Cart', toApiError(actionError).message);
    }
  };

  // Session restore: avoid flashing the guest prompt while the stored session
  // is still being verified.
  if (isRestoring) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading your cart…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>Sign in to use your cart</Text>
          <Text style={styles.emptyText}>
            Your cart is saved to your customer account. Log in to add products and see your
            items here.
          </Text>
          <Pressable
            onPress={handleLogin}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text style={styles.emptyButtonText}>Login</Text>
          </Pressable>
          <Pressable
            onPress={handleContinueShopping}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
          >
            <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Customer accounts only</Text>
          <Text style={styles.emptyText}>Cart is available for customer accounts only.</Text>
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading your cart…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load your cart. Please try again.';
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn&apos;t load your cart</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Retry loading cart"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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

  const hasUnavailable = items.some((item) => !item.available);

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
          onPress={() => {
            void runAction(clearCart);
          }}
          disabled={isMutating}
          style={({ pressed }) => [(pressed || isMutating) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Clear cart"
          accessibilityState={{ disabled: isMutating, busy: isClearing }}
        >
          <Text style={[styles.clearText, isMutating && styles.clearTextDisabled]}>
            {isClearing ? 'Clearing…' : 'Clear Cart'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            disabled={isMutating}
            pending={pendingItemId === item.id}
            onIncrease={() => {
              void runAction(() => increaseQuantity(item.id));
            }}
            onDecrease={() => {
              void runAction(() => decreaseQuantity(item.id));
            }}
            onRemove={() => {
              void runAction(() => removeItem(item.id));
            }}
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
        {hasUnavailable && (
          <Text style={styles.summaryCaption}>Excludes unavailable items.</Text>
        )}
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
  clearTextDisabled: {
    opacity: 0.5,
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
  // Centered loading/error states
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorIcon: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  errorText: {
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
  },
  // Empty / guest / non-customer states
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
  secondaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
