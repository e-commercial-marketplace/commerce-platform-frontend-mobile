/**
 * COD and VNPay checkout for the cart lines selected on the Cart screen.
 *
 * The route carries only cart-item ids. Items, prices and availability are
 * resolved against the authoritative Cart query, never trusted from
 * navigation params. Before submitting, every id must still exist and be
 * purchasable; otherwise the screen asks the user to return to Cart.
 *
 * The request is { cartItemIds, shippingAddress, paymentMethod, voucherCode? }.
 * Totals shown before checkout are a local preview; the order total displayed
 * after success is `OrderResponse.totalAmount` from the backend.
 *
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 * Localized across English and Vietnamese via i18next checkout namespace.
 */

import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import Button from '../components/Button';
import VoucherRow from '../components/VoucherRow';
import FormField from '../components/FormField';
import ProductImage from '../components/ProductImage';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useCart } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import { useUsableVouchers, useValidateVoucher } from '../hooks/useVoucher';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { CartLine } from '../types/cart';
import type { OrderResponse, PaymentMethod } from '../types/orderApi';
import type { VoucherResponse } from '../types/voucherApi';
import { formatVND } from '../utils/format';
import { markPaymentUrlHandled } from '../utils/paymentDeepLink';

const CHECKOUT_VOUCHER_COUNT = 3;
const BEST_VOUCHER_LABEL = 'Best choice';

const MAX_ADDRESS_LENGTH = 1000;

/**
 * Frontend UX validation for shipping addresses.
 *
 * Mirrors the backend contract (@NotBlank + @Size(max=1000)) without loosening
 * it, but rejects meaningless values like "!!!" or "12345". The letter check is
 * Unicode-aware so Vietnamese characters are accepted.
 */
function validateShippingAddress(
  value: string,
  t?: (key: string, def?: string, options?: Record<string, unknown>) => string,
): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return t ? t('checkout.addressRequired', 'Shipping address is required.') : 'Shipping address is required.';
  }
  if (trimmed.length < 5) {
    return t
      ? t('checkout.addressMinLength', 'Shipping address must be at least 5 characters.')
      : 'Shipping address must be at least 5 characters.';
  }
  if (trimmed.length > MAX_ADDRESS_LENGTH) {
    return t
      ? t(
          'checkout.addressMaxLength',
          `Shipping address must not exceed ${MAX_ADDRESS_LENGTH} characters.`,
          { max: MAX_ADDRESS_LENGTH },
        )
      : `Shipping address must not exceed ${MAX_ADDRESS_LENGTH} characters.`;
  }
  // Unicode letter required (supports Vietnamese and other scripts).
  if (!/\p{L}/u.test(trimmed)) {
    return t
      ? t('checkout.addressMustContainLetters', 'Shipping address must contain letters.')
      : 'Shipping address must contain letters.';
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

/** Parses transient query hints from VNPay redirect URI. Authoritative state comes from GET /orders/{id}. */
function parseRedirectUrl(url: string): { orderId?: string; status?: 'COMPLETED' | 'FAILED' | 'INVALID' } {
  try {
    const qIndex = url.indexOf('?');
    if (qIndex === -1) {
      return {};
    }
    const queryString = url.slice(qIndex + 1);
    const params = new URLSearchParams(queryString);
    const orderId = params.get('orderId') || undefined;
    const rawStatus = params.get('status');
    let status: 'COMPLETED' | 'FAILED' | 'INVALID' | undefined;
    if (rawStatus === 'COMPLETED' || rawStatus === 'FAILED' || rawStatus === 'INVALID') {
      status = rawStatus;
    }
    return { orderId, status };
  } catch {
    return {};
  }
}

export default function CheckoutScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'Checkout'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { user, isAuthenticated, isRestoring } = useAuth();
  const { items, isLoading, isFetching, isError, error, refetch, isCustomer } = useCart();
  const { placeOrder, isPending } = useCheckout();
  const validateVoucherMutation = useValidateVoucher();
  // The API already sorts the highest % first, so the first row is the best choice; on error the suggestion is hidden and the input still works.
  const suggestedVouchers =
    useUsableVouchers().data?.pages[0]?.content.slice(0, CHECKOUT_VOUCHER_COUNT) ?? [];
  const queryClient = useQueryClient();

  const { cartItemIds } = route.params;
  const [address, setAddress] = useState('');
  const { data: profile } = useCurrentUser(isCustomer);
  // While the profile is loading, failed or has no address, this choice is absent and only the input remains.
  const savedAddress = profile?.address?.trim() || null;
  // The profile address is not used by default so a customer does not accidentally ship to an old address.
  const [useSavedAddress, setUseSavedAddress] = useState(false);
  const usingSavedAddress = useSavedAddress && savedAddress != null;
  const selectedAddress = usingSavedAddress ? savedAddress : address;
  const [addressError, setAddressError] = useState<string | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [formError, setFormError] = useState<string | null>(null);
  const [cartProblem, setCartProblem] = useState(false);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Voucher state
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

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

  // Discount preview (non-authoritative estimate)
  const discountPercent = appliedVoucher ? appliedVoucher.discountPercent : 0;
  const estimatedDiscount = appliedVoucher
    ? Math.round((selectedSubtotal * discountPercent) / 100)
    : 0;
  const estimatedTotal = Math.max(0, selectedSubtotal - estimatedDiscount);

  const isValidatingVoucher = validateVoucherMutation.isPending;
  const busy = submitting || isPending;

  const handleAddressChange = (value: string) => {
    setAddress(value);
    setAddressError(undefined);
    setFormError(null);
  };

  const handleApplyVoucher = async (code?: string) => {
    const trimmed = (code ?? voucherInput).trim();
    if (trimmed.length === 0) {
      setVoucherError(t('checkout.voucherRequired', 'Please enter a voucher code.'));
      return;
    }
    setVoucherError(null);

    try {
      const voucher = await validateVoucherMutation.mutateAsync(trimmed);
      setAppliedVoucher(voucher);
      setVoucherInput('');
      setVoucherError(null);
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.code === 'RESOURCE_NOT_FOUND') {
        setVoucherError(
          t('checkout.voucherNotFound', 'Voucher code not found. Please check and try again.'),
        );
      } else if (apiError.code === 'VOUCHER_EXPIRED') {
        setVoucherError(
          t('checkout.voucherExpired', 'This voucher is not active at this time.'),
        );
      } else if (apiError.code === 'VOUCHER_EXHAUSTED') {
        setVoucherError(
          t('checkout.voucherExhausted', 'This voucher has reached its usage limit.'),
        );
      } else if (apiError.status === 401) {
        setVoucherError(
          t('checkout.voucherSignInRequired', 'Please sign in to apply vouchers.'),
        );
      } else if (apiError.status === 403) {
        setVoucherError(
          t(
            'checkout.voucherCustomerOnly',
            'Vouchers are available for customer accounts only.',
          ),
        );
      } else {
        setVoucherError(
          apiError.message ||
            t(
              'checkout.voucherValidationError',
              'Failed to validate voucher. Please try again.',
            ),
        );
      }
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError(null);
  };

  const handlePlaceOrder = async () => {
    if (submittingRef.current || busy) {
      return;
    }
    if (!selectionIsValid) {
      setCartProblem(true);
      return;
    }

    const trimmedAddress = selectedAddress.trim();
    const validationError = validateShippingAddress(selectedAddress, t);
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
        paymentMethod,
        voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
      });
      if (created != null) {
        if (paymentMethod === 'COD') {
          setOrder(created);
          return;
        }

        // VNPay online payment flow
        if (!created.paymentUrl || created.paymentUrl.trim().length === 0) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.orders.detail(created.id),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.orders.lists,
          });
          navigation.navigate('OrderDetail', {
            orderId: created.id,
            paymentHint: 'FAILED',
          });
          return;
        }

        let authResult: WebBrowser.WebBrowserAuthSessionResult;
        try {
          authResult = await WebBrowser.openAuthSessionAsync(
            created.paymentUrl,
            'marketplace://payment-result',
          );
        } catch {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.orders.detail(created.id),
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.orders.lists,
          });
          navigation.navigate('OrderDetail', {
            orderId: created.id,
            paymentHint: 'FAILED',
          });
          return;
        }

        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(created.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.lists,
        });

        if (authResult.type === 'success' && authResult.url) {
          markPaymentUrlHandled(authResult.url);
          const parsed = parseRedirectUrl(authResult.url);
          const paymentHint = parsed.status || 'COMPLETED';
          navigation.navigate('OrderDetail', {
            orderId: created.id,
            paymentHint,
          });
        } else {
          navigation.navigate('OrderDetail', {
            orderId: created.id,
            paymentHint: 'CANCELLED',
          });
        }
      }
    } catch (checkoutError) {
      const apiError = toApiError(checkoutError);

      if (apiError.code === 'VOUCHER_EXHAUSTED') {
        setFormError(
          t(
            'checkout.voucherExhaustedOrder',
            'This voucher has reached its usage limit. Please try another or continue without a voucher.',
          ),
        );
        setAppliedVoucher(null);
      } else if (apiError.code === 'VOUCHER_EXPIRED') {
        setFormError(
          t(
            'checkout.voucherExpiredOrder',
            'This voucher is no longer active. Please try another or continue without a voucher.',
          ),
        );
        setAppliedVoucher(null);
      } else if (apiError.code === 'RESOURCE_NOT_FOUND' && appliedVoucher != null) {
        setFormError(
          t(
            'checkout.voucherInvalidOrder',
            'Voucher is no longer valid. Please try another or continue without a voucher.',
          ),
        );
        setAppliedVoucher(null);
      } else {
        setFormError(apiError.message);
        setAddressError(apiError.fieldErrors?.shippingAddress);
      }

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
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('checkout.loadingCheckout', 'Loading checkout…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🔐</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('checkout.signInTitle', 'Sign in to checkout')}
          </Text>
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('checkout.signInDesc', 'Checkout is available for customer accounts.')}
          </Text>
          <Button
            title={t('checkout.login', 'Login')}
            onPress={() => navigation.navigate('Login')}
            fullWidth
            style={styles.stateButton}
          />
          <Button
            title={t('checkout.backToCart', 'Back to Cart')}
            onPress={backToCart}
            variant="secondary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!isCustomer) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🛒</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('checkout.customerOnlyTitle', 'Customer accounts only')}
          </Text>
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t(
              'checkout.customerOnlyMessage',
              'Checkout is available for customer accounts only.',
            )}
          </Text>
          <Button
            title={t('checkout.backToCart', 'Back to Cart')}
            onPress={backToCart}
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  if (order != null) {
    const orderDiscount = parseMoney(order.discountAmount);

    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successHeader}>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={[styles.successTitle, { color: theme.text }]}>
              {t('checkout.orderSuccessTitle', 'Order placed successfully')}
            </Text>
            <Text style={[styles.centerText, { color: theme.textSecondary }]}>
              {t(
                'checkout.orderSuccessCodDesc',
                'Cash on delivery orders are paid when the order is delivered.',
              )}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.orderId', 'Order ID')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]} selectable>
                {order.id}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.paymentMethod', 'Payment method')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {t('checkout.cod', 'Cash on delivery (COD)')}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.orderStatus', 'Order status')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {humanizeStatus(order.status)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.paymentStatus', 'Payment status')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {humanizeStatus(order.paymentStatus)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.shippingAddress', 'Shipping address')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {order.shippingAddress}
              </Text>
            </View>
            {order.voucherCode != null && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                  {t('checkout.voucher', 'Voucher')}
                </Text>
                <Text style={[styles.rowValue, { color: theme.text }]}>
                  {order.voucherCode}
                </Text>
              </View>
            )}
            {orderDiscount > 0 && (
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                  {t('checkout.discount', 'Discount')}
                </Text>
                <Text style={[styles.discountValue, { color: theme.primary }]}>
                  -{formatVND(orderDiscount)}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.row,
                styles.totalRow,
                { borderTopColor: theme.border },
              ]}
            >
              <Text style={[styles.totalLabel, { color: theme.text }]}>
                {t('checkout.total', 'Total')}
              </Text>
              <Text style={[styles.totalValue, { color: theme.text }]}>
                {formatVND(parseMoney(order.totalAmount))}
              </Text>
            </View>
          </View>

          <Button
            title={t('checkout.continueShopping', 'Continue Shopping')}
            onPress={goShopping}
            fullWidth
            accessibilityLabel={t('checkout.continueShopping', 'Continue Shopping')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isLoading || isFetching) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t('checkout.checkingCart', 'Checking your cart…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to load your cart. Please try again.';
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('checkout.errorLoadingCart', "Couldn't load your cart")}
          </Text>
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {errorMessage}
          </Text>
          <Button
            title={t('checkout.retry', 'Retry')}
            onPress={() => void refetch()}
            fullWidth
            style={styles.stateButton}
          />
          <Button
            title={t('checkout.backToCart', 'Back to Cart')}
            onPress={backToCart}
            variant="secondary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  if (cartProblem || !selectionIsValid) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['bottom']}
        testID="checkout-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🛒</Text>
          <Text style={[styles.stateTitle, { color: theme.text }]}>
            {t('checkout.cartChangedTitle', 'Your cart changed')}
          </Text>
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {t(
              'checkout.cartUnavailableNotice',
              'One or more items you selected are no longer available. Please return to your cart and review your selection before placing the order.',
            )}
          </Text>
          {formError != null && (
            <Text style={[styles.formError, { color: theme.danger }]}>
              {formError}
            </Text>
          )}
          <Button
            title={t('checkout.backToCart', 'Back to Cart')}
            onPress={backToCart}
            fullWidth
            style={styles.stateButton}
          />
          <Button
            title={t('checkout.refreshCart', 'Refresh Cart')}
            onPress={() => void refetch()}
            variant="secondary"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="checkout-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.checkoutKicker, { color: theme.primary }]}>
            {t('checkout.orderReview', 'ORDER REVIEW')}
          </Text>
          <Text style={[styles.checkoutTitle, { color: theme.text }]}>
            {t('checkout.title', 'Checkout')}
          </Text>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('checkout.selectedItems', 'Selected items')}
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            {resolvedLines.map((line) => (
              <View key={line.id} style={styles.itemRow}>
                <ProductImage source={line.image} style={styles.thumb} />
                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemName, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {line.name}
                  </Text>
                  <Text
                    style={[styles.itemMeta, { color: theme.textSecondary }]}
                  >
                    {line.quantity} × {formatVND(line.unitPrice)}
                  </Text>
                </View>
                <Text style={[styles.itemTotal, { color: theme.text }]}>
                  {formatVND(line.lineTotal)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('checkout.shippingAddress', 'Shipping address')}
          </Text>
          {savedAddress != null ? (
            <View style={styles.paymentMethodContainer} accessibilityRole="radiogroup">
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={t(
                  'checkout.useSavedAddressLabel',
                  `Use my saved address: ${savedAddress}`,
                  { address: savedAddress },
                )}
                accessibilityState={{ checked: usingSavedAddress }}
                disabled={busy}
                onPress={() => {
                  setUseSavedAddress(true);
                  setAddressError(undefined);
                }}
                style={({ pressed }) => [
                  styles.paymentOptionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  usingSavedAddress && [
                    styles.paymentOptionCardSelected,
                    {
                      borderColor: theme.primary,
                      backgroundColor: isDark ? 'rgba(8, 145, 178, 0.12)' : '#F8FAFC',
                    },
                  ],
                  pressed && !busy && styles.paymentOptionPressed,
                ]}
              >
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: theme.border },
                    usingSavedAddress && [
                      styles.radioCircleSelected,
                      { borderColor: theme.primary },
                    ],
                  ]}
                >
                  {usingSavedAddress && (
                    <View
                      style={[
                        styles.radioCircleDot,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={[styles.paymentOptionTitle, { color: theme.text }]}>
                    {t('checkout.useSavedAddress', 'Use my saved address')}
                  </Text>
                  <Text style={[styles.paymentOptionDesc, { color: theme.textSecondary }]}>
                    {savedAddress}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={t('checkout.enterDifferentAddress', 'Enter a different address')}
                accessibilityState={{ checked: !usingSavedAddress }}
                disabled={busy}
                onPress={() => {
                  setUseSavedAddress(false);
                  setAddressError(undefined);
                }}
                style={({ pressed }) => [
                  styles.paymentOptionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  !usingSavedAddress && [
                    styles.paymentOptionCardSelected,
                    {
                      borderColor: theme.primary,
                      backgroundColor: isDark ? 'rgba(8, 145, 178, 0.12)' : '#F8FAFC',
                    },
                  ],
                  pressed && !busy && styles.paymentOptionPressed,
                ]}
              >
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: theme.border },
                    !usingSavedAddress && [
                      styles.radioCircleSelected,
                      { borderColor: theme.primary },
                    ],
                  ]}
                >
                  {!usingSavedAddress && (
                    <View
                      style={[
                        styles.radioCircleDot,
                        { backgroundColor: theme.primary },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={[styles.paymentOptionTitle, { color: theme.text }]}>
                    {t('checkout.enterDifferentAddress', 'Enter a different address')}
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}
          {usingSavedAddress ? (
            addressError != null && <Text style={[styles.savedAddressError, { color: theme.danger }]}>{addressError}</Text>
          ) : (
            <FormField
              label={t('checkout.shippingAddress', 'Shipping address')}
              value={address}
              onChangeText={handleAddressChange}
              placeholder={t(
                'checkout.shippingAddressPlaceholder',
                'Street, city, province…',
              )}
              error={addressError}
              editable={!busy}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={() => {
                void handlePlaceOrder();
              }}
            />
          )}

          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('checkout.paymentMethod', 'Payment method')}
          </Text>
          <View style={styles.paymentMethodContainer}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={t('checkout.cod', 'Cash on Delivery (COD)')}
              accessibilityState={{ checked: paymentMethod === 'COD' }}
              disabled={busy}
              onPress={() => setPaymentMethod('COD')}
              style={({ pressed }) => [
                styles.paymentOptionCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                paymentMethod === 'COD' && [
                  styles.paymentOptionCardSelected,
                  {
                    borderColor: theme.primary,
                    backgroundColor: isDark ? 'rgba(8, 145, 178, 0.12)' : '#F8FAFC',
                  },
                ],
                pressed && !busy && styles.paymentOptionPressed,
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: theme.border },
                  paymentMethod === 'COD' && [
                    styles.radioCircleSelected,
                    { borderColor: theme.primary },
                  ],
                ]}
              >
                {paymentMethod === 'COD' && (
                  <View
                    style={[
                      styles.radioCircleDot,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                )}
              </View>
              <View style={styles.paymentOptionInfo}>
                <Text style={[styles.paymentOptionTitle, { color: theme.text }]}>
                  {t('checkout.cod', 'Cash on Delivery (COD)')}
                </Text>
                <Text
                  style={[
                    styles.paymentOptionDesc,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t('checkout.codDesc', 'Pay when you receive your order.')}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={t('checkout.vnpay', 'VNPay')}
              accessibilityState={{ checked: paymentMethod === 'VNPAY' }}
              disabled={busy}
              onPress={() => setPaymentMethod('VNPAY')}
              style={({ pressed }) => [
                styles.paymentOptionCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                paymentMethod === 'VNPAY' && [
                  styles.paymentOptionCardSelected,
                  {
                    borderColor: theme.primary,
                    backgroundColor: isDark ? 'rgba(8, 145, 178, 0.12)' : '#F8FAFC',
                  },
                ],
                pressed && !busy && styles.paymentOptionPressed,
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  { borderColor: theme.border },
                  paymentMethod === 'VNPAY' && [
                    styles.radioCircleSelected,
                    { borderColor: theme.primary },
                  ],
                ]}
              >
                {paymentMethod === 'VNPAY' && (
                  <View
                    style={[
                      styles.radioCircleDot,
                      { backgroundColor: theme.primary },
                    ]}
                  />
                )}
              </View>
              <View style={styles.paymentOptionInfo}>
                <Text style={[styles.paymentOptionTitle, { color: theme.text }]}>
                  {t('checkout.vnpay', 'VNPay')}
                </Text>
                <Text
                  style={[
                    styles.paymentOptionDesc,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t(
                    'checkout.vnpayDesc',
                    'Pay securely online through VNPay.',
                  )}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('checkout.platformVoucher', 'Platform voucher')}
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            {appliedVoucher == null ? (
              <View style={styles.voucherContainer}>
                <View style={styles.voucherInputRow}>
                  <TextInput
                    style={[
                      styles.voucherInput,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                      voucherError != null && { borderColor: theme.danger },
                    ]}
                    value={voucherInput}
                    onChangeText={(text) => {
                      setVoucherInput(text);
                      if (voucherError != null) setVoucherError(null);
                    }}
                    placeholder={t(
                      'checkout.voucherPlaceholder',
                      'Enter voucher code…',
                    )}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!busy && !isValidatingVoucher}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void handleApplyVoucher();
                    }}
                    accessibilityLabel={t(
                      'checkout.voucherInputA11y',
                      'Voucher code input',
                    )}
                  />
                  <Button
                    title={t('checkout.apply', 'Apply')}
                    onPress={() => {
                      void handleApplyVoucher();
                    }}
                    loading={isValidatingVoucher}
                    disabled={busy || isValidatingVoucher}
                    style={styles.voucherApplyButton}
                    accessibilityLabel={t(
                      'checkout.applyVoucherA11y',
                      'Apply voucher',
                    )}
                  />
                </View>
                {voucherError != null && (
                  <Text
                    style={[styles.voucherErrorText, { color: theme.danger }]}
                  >
                    {voucherError}
                  </Text>
                )}
                {suggestedVouchers.map((voucher, index) => (
                  <VoucherRow
                    key={voucher.code}
                    voucher={voucher}
                    badge={index === 0 ? t('checkout.bestChoice', BEST_VOUCHER_LABEL) : undefined}
                    disabled={busy || isValidatingVoucher}
                    onApply={() => {
                      void handleApplyVoucher(voucher.code);
                    }}
                  />
                ))}
                {suggestedVouchers.length > 0 ? (
                  <Pressable
                    style={styles.viewAllVouchers}
                    onPress={() => navigation.navigate('Vouchers')}
                    accessibilityRole="button"
                    accessibilityLabel={t('checkout.viewAllVouchersA11y', 'View all vouchers')}
                  >
                    <Text style={[styles.viewAllVouchersText, { color: theme.primary }]}>
                      {t('checkout.viewAllVouchers', 'View all')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.appliedVoucherCard}>
                <View style={styles.appliedVoucherLeft}>
                  <View style={styles.appliedVoucherBadge}>
                    <Text
                      style={[
                        styles.appliedVoucherCode,
                        { color: theme.primary },
                      ]}
                    >
                      {appliedVoucher.code}
                    </Text>
                    <Text
                      style={[
                        styles.appliedVoucherPercent,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      -{appliedVoucher.discountPercent}%
                    </Text>
                  </View>
                  {appliedVoucher.description ? (
                    <Text
                      style={[
                        styles.appliedVoucherDesc,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {appliedVoucher.description}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleRemoveVoucher}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.removeVoucherButton,
                    { borderColor: theme.danger },
                    pressed && styles.removeVoucherButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'checkout.removeVoucherA11y',
                    'Remove voucher',
                  )}
                >
                  <Text
                    style={[styles.removeVoucherText, { color: theme.danger }]}
                  >
                    {t('checkout.removeVoucher', 'Remove')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('checkout.orderSummary', 'Order summary')}
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.itemsSubtotal', 'Items subtotal')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {formatVND(selectedSubtotal)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.shippingFee', 'Shipping fee')}
              </Text>
              <Text style={[styles.rowValue, { color: theme.text }]}>
                {formatVND(0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>
                {t('checkout.discount', 'Discount')}
              </Text>
              <Text
                style={
                  estimatedDiscount > 0
                    ? [styles.discountValue, { color: theme.primary }]
                    : [styles.rowValue, { color: theme.text }]
                }
              >
                {estimatedDiscount > 0
                  ? `-${formatVND(estimatedDiscount)}`
                  : formatVND(0)}
              </Text>
            </View>
            <View
              style={[
                styles.row,
                styles.totalRow,
                { borderTopColor: theme.border },
              ]}
            >
              <Text style={[styles.totalLabel, { color: theme.text }]}>
                {t('checkout.estimatedTotal', 'Estimated total')}
              </Text>
              <Text style={[styles.totalValue, { color: theme.text }]}>
                {formatVND(estimatedTotal)}
              </Text>
            </View>
          </View>

          {formError != null && (
            <Text style={[styles.formError, { color: theme.danger }]}>
              {formError}
            </Text>
          )}

          <Button
            title={
              paymentMethod === 'VNPAY'
                ? t('checkout.proceedToVnpay', 'Proceed to VNPay')
                : t('checkout.placeOrder', 'Place Order')
            }
            onPress={() => {
              void handlePlaceOrder();
            }}
            loading={busy}
            disabled={busy}
            fullWidth
            accessibilityLabel={
              paymentMethod === 'VNPAY'
                ? t('checkout.proceedToVnpay', 'Proceed to VNPay')
                : t('checkout.placeOrder', 'Place Order')
            }
          />
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            {t(
              'checkout.totalFootnote',
              'The backend total is authoritative and may differ slightly from this preview.',
            )}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
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
  },
  itemMeta: {
    fontSize: 13,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  rowValue: {
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  discountValue: {
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  formError: {
    fontSize: 13,
    textAlign: 'center',
  },
  footnote: {
    fontSize: 12,
    textAlign: 'center',
  },
  successHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  successIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    textAlign: 'center',
  },
  stateIcon: {
    fontSize: 44,
  },
  stateTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateButton: {
    marginTop: spacing.md,
  },

  checkoutKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  checkoutTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sectionDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  successCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#18B65B',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  // Voucher section styles
  voucherContainer: {
    gap: spacing.xs,
  },
  viewAllVouchers: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllVouchersText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voucherInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
  },
  voucherApplyButton: {
    minWidth: 84,
  },
  voucherErrorText: {
    fontSize: 12,
    marginTop: 2,
  },
  appliedVoucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  appliedVoucherLeft: {
    flex: 1,
    gap: 4,
  },
  appliedVoucherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  appliedVoucherCode: {
    fontSize: 15,
    fontWeight: '700',
  },
  appliedVoucherPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  appliedVoucherDesc: {
    fontSize: 12,
  },
  removeVoucherButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  removeVoucherButtonPressed: {
    opacity: 0.7,
  },
  removeVoucherText: {
    fontSize: 12,
    fontWeight: '600',
  },
  savedAddressError: {
    fontSize: 13,
    color: colors.danger,
  },
  paymentMethodContainer: {
    gap: spacing.sm,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  paymentOptionCardSelected: {},
  paymentOptionPressed: {
    opacity: 0.7,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {},
  radioCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentOptionInfo: {
    flex: 1,
    gap: 2,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  paymentOptionDesc: {
    fontSize: 13,
  },
});
