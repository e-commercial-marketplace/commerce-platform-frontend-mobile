/**
 * Shopping cart screen backed by the real Cart API (via `useCart`).
 *
 * Customer states:
 * - loading      -> spinner;
 * - error        -> backend/normalized message + Retry;
 * - empty        -> empty state whose "Continue Shopping" returns to Home;
 * - items        -> server cart lines + selection + preview subtotal.
 *
 * Guests get a sign-in prompt (no guest server cart exists); sellers/admins
 * are told the cart is customer-only and no cart request is made for them.
 *
 * Checkout selection is local UI state keyed by cart-item id. All purchasable
 * lines are selected after the first authoritative cart load; unavailable
 * lines stay visible but can never be selected. The footer shows a preview
 * subtotal for the selection, not the backend cart subtotal (which covers
 * every purchasable line).
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import CartItemRow from '../components/CartItemRow';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import type { MainTabScreenProps } from '../navigation/types';
import {
  createDefaultSelection,
  getSelectedCartItemIds,
  getSelectedSubtotal,
  reconcileCartSelection,
} from '../utils/cartSelection';
import { formatVND } from '../utils/format';

export default function CartScreen({ navigation }: MainTabScreenProps<'Cart'>) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  const {
    items,
    totalItems,
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

  // `null` means "no authoritative cart loaded yet". Once loaded, the default
  // is every purchasable line; later data changes only prune the selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectionInitialized = useRef(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    setSelectedIds((previous) => {
      if (!selectionInitialized.current) {
        selectionInitialized.current = true;
        return createDefaultSelection(items);
      }
      return reconcileCartSelection(previous, items);
    });
  }, [items, isLoading]);

  const selectedItemIds = getSelectedCartItemIds(items, selectedIds);
  const selectedSubtotal = getSelectedSubtotal(items, selectedIds);
  const hasSelection = selectedItemIds.length > 0;

  const handleContinueShopping = () => navigation.navigate('Home');
  const handleLogin = () => navigation.navigate('Login');

  const handleCheckout = () => {
    if (!hasSelection) {
      return;
    }
    navigation.navigate('Checkout', { cartItemIds: selectedItemIds });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
            selected={selectedIds.has(item.id)}
            onToggleSelected={() => toggleSelected(item.id)}
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
          <Text style={styles.summaryLabel}>Selected subtotal</Text>
          <Text style={styles.summaryValue}>{formatVND(selectedSubtotal)}</Text>
        </View>
        <Text style={styles.summaryCaption}>
          {selectedItemIds.length} of {totalItems} {totalItems === 1 ? 'item' : 'items'} selected
        </Text>
        {hasUnavailable && (
          <Text style={styles.summaryCaption}>Excludes unavailable items.</Text>
        )}
        <Pressable
          onPress={handleCheckout}
          disabled={!hasSelection || isMutating}
          style={({ pressed }) => [
            styles.checkoutButton,
            (!hasSelection || isMutating) && styles.checkoutButtonDisabled,
            pressed && hasSelection && !isMutating && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
          accessibilityState={{ disabled: !hasSelection || isMutating }}
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
  checkoutButtonDisabled: {
    opacity: 0.5,
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
