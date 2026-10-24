/**
 * COD checkout for the cart lines selected on the Cart screen.
 *
 * The route carries only cart-item ids. Items, prices and availability are
 * resolved against the authoritative Cart query, never trusted from
 * navigation params. Before submitting, every id must still exist and be
 * purchasable; otherwise the screen asks the user to return to Cart.
 *
 * The request is exactly { cartItemIds, shippingAddress, paymentMethod: COD }.
 * Totals shown before checkout are a local preview; the order total displayed
 * after success is `OrderResponse.totalAmount` from the backend.
 */

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import Button from '../components/Button';
import FormField from '../components/FormField';
import ProductImage from '../components/ProductImage';
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { CartLine } from '../types/cart';
import type { OrderResponse } from '../types/orderApi';
import { formatVND } from '../utils/format';

const MAX_ADDRESS_LENGTH = 1000;

/**
 * Frontend UX validation for shipping addresses.
 *
 * Mirrors the backend contract (@NotBlank + @Size(max=1000)) without loosening
 * it, but rejects meaningless values like "!!!" or "12345". The letter check is
 * Unicode-aware so Vietnamese characters are accepted.
 */
function validateShippingAddress(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return 'Shipping address is required.';
  }
  if (trimmed.length < 5) {
    return 'Shipping address must be at least 5 characters.';
  }
  if (trimmed.length > MAX_ADDRESS_LENGTH) {
    return `Shipping address must not exceed ${MAX_ADDRESS_LENGTH} characters.`;
  }
  // Unicode letter required (supports Vietnamese and other scripts).
  if (!/\p{L}/u.test(trimmed)) {
    return 'Shipping address must contain letters.';
  }

  return undefined;
}

/** Failures that mean the client cart snapshot may be stale. */
const STALE_CART_CODES = new Set([
  'CART_ITEM_NOT_FOUND',
  'PRODUCT_INACTIVE',
  'INSUFFICIENT_STOCK',
]);

/** Parses a backend decimal money string for display only. */
function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Shows backend enum values in title case (e.g. PENDING -> Pending). */
function humanizeStatus(value: string): string {
  return value.length === 0 ? value : value.charAt(0) + value.slice(1).toLowerCase();
}

export default function CheckoutScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'Checkout'>) {
  const { user, isAuthenticated, isRestoring } = useAuth();
  const { items, isLoading, isFetching, isError, error, refetch, isCustomer } = useCart();
  const { placeOrder, isPending } = useCheckout();

  const { cartItemIds } = route.params;
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [cartProblem, setCartProblem] = useState(false);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const backToCart = () => navigation.navigate('Main', { screen: 'Cart' });
  const goShopping = () => navigation.navigate('Main', { screen: 'Home' });

  // Resolve the navigation ids against the current authoritative cart.
  const resolvedLines: CartLine[] = [];
  for (const id of cartItemIds) {
    const line = items.find((item) => item.id === id);
    if (line != null && line.available) {
      resolvedLines.push(line);
    }
  }
  const hasDuplicateIds = new Set(cartItemIds).size !== cartItemIds.length;
  const hasInvalidIds = cartItemIds.length === 0 || resolvedLines.length !== cartItemIds.length;
  const selectionIsValid = !hasDuplicateIds && !hasInvalidIds;
  const resolvedIds = resolvedLines.map((line) => line.id);
  const selectedSubtotal = resolvedLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const busy = submitting || isPending;

  const handleAddressChange = (value: string) => {
    setAddress(value);
    setAddressError(undefined);
    setFormError(null);
  };

  const handlePlaceOrder = async () => {
    if (submittingRef.current || busy) {
      return;
    }
    if (!selectionIsValid) {
      setCartProblem(true);
      return;
    }

    const trimmedAddress = address.trim();
    const validationError = validateShippingAddress(address);
    if (validationError != null) {
      setAddressError(validationError);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    setAddressError(undefined);

    try {
      const created = await placeOrder({
        cartItemIds: resolvedIds,
        shippingAddress: trimmedAddress,
        paymentMethod: 'COD',
      });
      if (created != null) {
        setOrder(created);
      }
    } catch (checkoutError) {
      const apiError = toApiError(checkoutError);
      setFormError(apiError.message);
      setAddressError(apiError.fieldErrors?.shippingAddress);

      // The client snapshot may be stale. Never resubmit automatically; ask
      // for the authoritative cart and send the user back to update it.
      if (STALE_CART_CODES.has(apiError.code)) {
        setCartProblem(true);
        void refetch();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (isRestoring) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Loading checkout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🔐</Text>
          <Text style={styles.stateTitle}>Sign in to checkout</Text>
          <Text style={styles.centerText}>Checkout is available for customer accounts.</Text>
          <Button
            title="Login"
            onPress={() => navigation.navigate('Login')}
            fullWidth
            style={styles.stateButton}
          />
          <Button title="Back to Cart" onPress={backToCart} variant="secondary" fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  if (!isCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🛒</Text>
          <Text style={styles.stateTitle}>Customer accounts only</Text>
          <Text style={styles.centerText}>Checkout is available for customer accounts only.</Text>
          <Button title="Back to Cart" onPress={backToCart} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  if (order != null) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successHeader}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Order placed successfully</Text>
            <Text style={styles.centerText}>
              Cash on delivery orders are paid when the order is delivered.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Order ID</Text>
              <Text style={styles.rowValue} selectable>
                {order.id}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Payment method</Text>
              <Text style={styles.rowValue}>Cash on delivery (COD)</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Order status</Text>
              <Text style={styles.rowValue}>{humanizeStatus(order.status)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Payment status</Text>
              <Text style={styles.rowValue}>{humanizeStatus(order.paymentStatus)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Shipping address</Text>
              <Text style={styles.rowValue}>{order.shippingAddress}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatVND(parseMoney(order.totalAmount))}</Text>
            </View>
          </View>

          <Button title="Continue Shopping" onPress={goShopping} fullWidth />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading || isFetching) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Checking your cart…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load your cart. Please try again.';
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.stateTitle}>Couldn&apos;t load your cart</Text>
          <Text style={styles.centerText}>{errorMessage}</Text>
          <Button title="Retry" onPress={() => void refetch()} fullWidth style={styles.stateButton} />
          <Button title="Back to Cart" onPress={backToCart} variant="secondary" fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  if (cartProblem || !selectionIsValid) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🛒</Text>
          <Text style={styles.stateTitle}>Your cart changed</Text>
          <Text style={styles.centerText}>
            One or more selected items are no longer available. Return to Cart to review your
            selection before placing the order.
          </Text>
          {formError != null && <Text style={styles.formError}>{formError}</Text>}
          <Button title="Back to Cart" onPress={backToCart} fullWidth style={styles.stateButton} />
          <Button
            title="Refresh Cart"
            onPress={() => void refetch()}
            variant="secondary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Selected items</Text>
          <View style={styles.card}>
            {resolvedLines.map((line) => (
              <View key={line.id} style={styles.itemRow}>
                <ProductImage source={line.image} style={styles.thumb} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {line.quantity} × {formatVND(line.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{formatVND(line.lineTotal)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Shipping address</Text>
          <FormField
            label="Shipping address"
            value={address}
            onChangeText={handleAddressChange}
            placeholder="Street, city, province…"
            error={addressError}
            editable={!busy}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handlePlaceOrder();
            }}
          />

          <Text style={styles.sectionTitle}>Payment method</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Cash on delivery (COD)</Text>
              <Text style={styles.rowValue}>Selected</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Order summary</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Items subtotal</Text>
              <Text style={styles.rowValue}>{formatVND(selectedSubtotal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Shipping fee</Text>
              <Text style={styles.rowValue}>{formatVND(0)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Discount</Text>
              <Text style={styles.rowValue}>{formatVND(0)}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Estimated total</Text>
              <Text style={styles.totalValue}>{formatVND(selectedSubtotal)}</Text>
            </View>
          </View>

          {formError != null && <Text style={styles.formError}>{formError}</Text>}

          <Button
            title="Place Order"
            onPress={() => {
              void handlePlaceOrder();
            }}
            loading={busy}
            disabled={busy}
            fullWidth
          />
          <Text style={styles.footnote}>
            The backend total is authoritative and may differ slightly from this preview.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
  },
  itemInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowLabel: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowValue: {
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  formError: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  footnote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  successHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 56,
    fontSize: 28,
    fontWeight: '700',
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
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
    textAlign: 'center',
  },
  stateIcon: {
    fontSize: 44,
  },
  stateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  stateButton: {
    marginTop: spacing.md,
  },
});
