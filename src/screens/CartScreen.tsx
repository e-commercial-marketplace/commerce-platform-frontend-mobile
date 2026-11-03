/**
 * Shopping cart screen backed by the real Cart API (via `useCart`).
 * Fully theme-aware with dynamic semantic tokens and localized strings.
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
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useAppLanguage } from '../i18n';
import type { MainTabScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import {
  createDefaultSelection,
  getSelectedCartItemIds,
  getSelectedSubtotal,
  reconcileCartSelection,
} from '../utils/cartSelection';
import { formatVND } from '../utils/format';

export default function CartScreen({ navigation }: MainTabScreenProps<'Cart'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
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

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (actionError) {
      Alert.alert(t('cart.title', 'Cart'), toApiError(actionError).message);
    }
  };

  if (isRestoring) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('cart.loadingCart', 'Loading your cart…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('cart.signInTitle', 'Sign in to use your cart')}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t(
              'cart.signInText',
              'Your cart is saved to your customer account. Log in to add products and see your items here.',
            )}
          </Text>
          <Pressable
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.login', 'Log in')}
          >
            <Text style={styles.emptyButtonText}>{t('cart.login', 'Login')}</Text>
          </Pressable>
          <Pressable
            onPress={handleContinueShopping}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: theme.surface, borderColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.continueShopping', 'Continue shopping')}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
              {t('cart.continueShopping', 'Continue Shopping')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isCustomer) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('cart.customerAccountsOnly', 'Customer accounts only')}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t(
              'cart.customerAccountsText',
              'Cart is available for customer accounts only.',
            )}
          </Text>
          <Pressable
            onPress={handleContinueShopping}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.continueShopping', 'Continue shopping')}
          >
            <Text style={styles.emptyButtonText}>
              {t('cart.continueShopping', 'Continue Shopping')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('cart.loadingCart', 'Loading your cart…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : t('cart.couldNotLoad', 'Failed to load your cart. Please try again.');
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('cart.couldNotLoad', "Couldn't load your cart")}
          </Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{errorMessage}</Text>
          <Pressable
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.retryLoadingCart', 'Retry loading cart')}
          >
            <Text style={styles.retryButtonText}>{t('cart.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="cart-screen"
      >
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('cart.emptyCartTitle', 'Your cart is empty')}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t(
              'cart.emptyCartText',
              'Browse the catalog and add products you love.',
            )}
          </Text>
          <Pressable
            onPress={handleContinueShopping}
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('cart.continueShopping', 'Continue shopping')}
          >
            <Text style={styles.emptyButtonText}>
              {t('cart.continueShopping', 'Continue Shopping')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasUnavailable = items.some((item) => !item.available);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="cart-screen"
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {t('cart.title', 'Cart')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {totalItems === 1
              ? t('cart.itemCount_one', '1 item')
              : t('cart.itemCount_other', `${totalItems} items`, { count: totalItems })}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void runAction(clearCart);
          }}
          disabled={isMutating}
          style={({ pressed }) => [(pressed || isMutating) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('cart.clearCart', 'Clear cart')}
          accessibilityState={{ disabled: isMutating, busy: isClearing }}
        >
          <Text
            style={[
              styles.clearText,
              { color: theme.danger },
              isMutating && styles.clearTextDisabled,
            ]}
          >
            {isClearing ? t('cart.clearing', 'Clearing…') : t('cart.clearCart', 'Clear Cart')}
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

      <View
        style={[
          styles.summary,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            {t('cart.selectedSubtotal', 'Selected subtotal')}
          </Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatVND(selectedSubtotal)}
          </Text>
        </View>
        <Text style={[styles.summaryCaption, { color: theme.textSecondary }]}>
          {t(
            'cart.selectedCount',
            `${selectedItemIds.length} of ${totalItems} ${totalItems === 1 ? 'item' : 'items'} selected`,
            {
              selected: selectedItemIds.length,
              total: totalItems,
              items: totalItems === 1 ? 'item' : 'items',
            },
          )}
        </Text>
        {hasUnavailable && (
          <Text style={[styles.summaryCaption, { color: theme.textSecondary }]}>
            {t('cart.excludesUnavailable', 'Excludes unavailable items.')}
          </Text>
        )}
        <Pressable
          onPress={handleCheckout}
          disabled={!hasSelection || isMutating}
          style={({ pressed }) => [
            styles.checkoutButton,
            { backgroundColor: theme.primary },
            (!hasSelection || isMutating || pressed) && styles.checkoutButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('cart.proceedToCheckout', 'Proceed to checkout')}
          accessibilityState={{ disabled: !hasSelection || isMutating }}
        >
          <Text style={styles.checkoutButtonText}>
            {hasSelection
              ? t('cart.checkoutSelected', `Checkout (${selectedItemIds.length})`, {
                  count: selectedItemIds.length,
                })
              : t('cart.checkout', 'Checkout')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  clearTextDisabled: {
    opacity: 0.4,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  summary: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  summaryCaption: {
    fontSize: 12,
  },
  checkoutButton: {
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  checkoutButtonDisabled: {
    opacity: 0.5,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  centerText: {
    fontSize: 14,
  },
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
    fontSize: typography.xl,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    borderRadius: radii.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: radii.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: radii.md,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.7,
  },
});
