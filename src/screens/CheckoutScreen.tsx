/**
 * COD checkout for the cart lines selected on the Cart screen.
 *
 * The route carries only cart-item ids. Items, prices and availability are
 * resolved against the authoritative Cart query, never trusted from
 * navigation params. Before submitting, every id must still exist and be
 * purchasable; otherwise the screen asks the user to return to Cart.
 *
 * The request is { cartItemIds, shippingAddress, paymentMethod: COD, voucherCode? }.
 * Totals shown before checkout are a local preview; the order total displayed
 * after success is `OrderResponse.totalAmount` from the backend.
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
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useCart } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import { useUsableVouchers, useValidateVoucher } from '../hooks/useVoucher';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { CartLine } from '../types/cart';
import type { OrderResponse, PaymentMethod } from '../types/orderApi';
import type { VoucherResponse } from '../types/voucherApi';
import { formatVND } from '../utils/format';
import { markPaymentUrlHandled } from '../utils/paymentDeepLink';

const CHECKOUT_VOUCHER_COUNT = 3;
const BEST_VOUCHER_LABEL = 'Lựa chọn tốt nhất';

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
  const { user, isAuthenticated, isRestoring } = useAuth();
  const { items, isLoading, isFetching, isError, error, refetch, isCustomer } = useCart();
  const { placeOrder, isPending } = useCheckout();
  const validateVoucherMutation = useValidateVoucher();
  // API đã xếp % cao nhất trước, nên dòng đầu là lựa chọn tốt nhất; lỗi thì ẩn gợi ý, ô nhập vẫn dùng được.
  const suggestedVouchers =
    useUsableVouchers().data?.pages[0]?.content.slice(0, CHECKOUT_VOUCHER_COUNT) ?? [];
  const queryClient = useQueryClient();

  const { cartItemIds } = route.params;
  const [address, setAddress] = useState('');
  const { data: profile } = useCurrentUser(isCustomer);
  // Hồ sơ đang tải, lỗi hoặc chưa có địa chỉ thì không có lựa chọn này, chỉ còn ô nhập.
  const savedAddress = profile?.address?.trim() || null;
  // Mặc định không dùng địa chỉ hồ sơ để khách không vô tình giao đến địa chỉ cũ.
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
      setVoucherError('Please enter a voucher code.');
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
        setVoucherError('Voucher code not found. Please check and try again.');
      } else if (apiError.code === 'VOUCHER_EXPIRED') {
        setVoucherError('This voucher is not active at this time.');
      } else if (apiError.code === 'VOUCHER_EXHAUSTED') {
        setVoucherError('This voucher has reached its usage limit.');
      } else if (apiError.status === 401) {
        setVoucherError('Please sign in to apply vouchers.');
      } else if (apiError.status === 403) {
        setVoucherError('Vouchers are available for customer accounts only.');
      } else {
        setVoucherError(apiError.message || 'Failed to validate voucher. Please try again.');
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
    const validationError = validateShippingAddress(selectedAddress);
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
        setFormError('This voucher has reached its usage limit. Please try another or continue without a voucher.');
        setAppliedVoucher(null);
      } else if (apiError.code === 'VOUCHER_EXPIRED') {
        setFormError('This voucher is no longer active. Please try another or continue without a voucher.');
        setAppliedVoucher(null);
      } else if (apiError.code === 'RESOURCE_NOT_FOUND' && appliedVoucher != null) {
        setFormError('Voucher is no longer valid. Please try another or continue without a voucher.');
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
    const orderDiscount = parseMoney(order.discountAmount);

    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successHeader}>
            <View style={styles.successCircle}><Text style={styles.successIcon}>✓</Text></View>
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
            {order.voucherCode != null && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Voucher</Text>
                <Text style={styles.rowValue}>{order.voucherCode}</Text>
              </View>
            )}
            {orderDiscount > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Discount</Text>
                <Text style={styles.discountValue}>-{formatVND(orderDiscount)}</Text>
              </View>
            )}
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
            One or more items you selected are no longer available. Please return to your cart and review your
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
          <Text style={styles.checkoutKicker}>ORDER REVIEW</Text>
          <Text style={styles.checkoutTitle}>Checkout</Text>
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

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Shipping address</Text>
          {savedAddress != null ? (
            <View style={styles.paymentMethodContainer} accessibilityRole="radiogroup">
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`Use my saved address: ${savedAddress}`}
                accessibilityState={{ checked: usingSavedAddress }}
                disabled={busy}
                onPress={() => {
                  setUseSavedAddress(true);
                  setAddressError(undefined);
                }}
                style={({ pressed }) => [
                  styles.paymentOptionCard,
                  usingSavedAddress && styles.paymentOptionCardSelected,
                  pressed && !busy && styles.paymentOptionPressed,
                ]}
              >
                <View style={[styles.radioCircle, usingSavedAddress && styles.radioCircleSelected]}>
                  {usingSavedAddress && <View style={styles.radioCircleDot} />}
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={styles.paymentOptionTitle}>Use my saved address</Text>
                  <Text style={styles.paymentOptionDesc}>{savedAddress}</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Enter a different address"
                accessibilityState={{ checked: !usingSavedAddress }}
                disabled={busy}
                onPress={() => {
                  setUseSavedAddress(false);
                  setAddressError(undefined);
                }}
                style={({ pressed }) => [
                  styles.paymentOptionCard,
                  !usingSavedAddress && styles.paymentOptionCardSelected,
                  pressed && !busy && styles.paymentOptionPressed,
                ]}
              >
                <View style={[styles.radioCircle, !usingSavedAddress && styles.radioCircleSelected]}>
                  {!usingSavedAddress && <View style={styles.radioCircleDot} />}
                </View>
                <View style={styles.paymentOptionInfo}>
                  <Text style={styles.paymentOptionTitle}>Enter a different address</Text>
                </View>
              </Pressable>
            </View>
          ) : null}
          {usingSavedAddress ? (
            addressError != null && <Text style={styles.savedAddressError}>{addressError}</Text>
          ) : (
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
          )}

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Payment method</Text>
          <View style={styles.paymentMethodContainer}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Cash on Delivery (COD)"
              accessibilityState={{ checked: paymentMethod === 'COD' }}
              disabled={busy}
              onPress={() => setPaymentMethod('COD')}
              style={({ pressed }) => [
                styles.paymentOptionCard,
                paymentMethod === 'COD' && styles.paymentOptionCardSelected,
                pressed && !busy && styles.paymentOptionPressed,
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  paymentMethod === 'COD' && styles.radioCircleSelected,
                ]}
              >
                {paymentMethod === 'COD' && <View style={styles.radioCircleDot} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <Text style={styles.paymentOptionTitle}>Cash on Delivery (COD)</Text>
                <Text style={styles.paymentOptionDesc}>Pay when you receive your order.</Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="VNPay"
              accessibilityState={{ checked: paymentMethod === 'VNPAY' }}
              disabled={busy}
              onPress={() => setPaymentMethod('VNPAY')}
              style={({ pressed }) => [
                styles.paymentOptionCard,
                paymentMethod === 'VNPAY' && styles.paymentOptionCardSelected,
                pressed && !busy && styles.paymentOptionPressed,
              ]}
            >
              <View
                style={[
                  styles.radioCircle,
                  paymentMethod === 'VNPAY' && styles.radioCircleSelected,
                ]}
              >
                {paymentMethod === 'VNPAY' && <View style={styles.radioCircleDot} />}
              </View>
              <View style={styles.paymentOptionInfo}>
                <Text style={styles.paymentOptionTitle}>VNPay</Text>
                <Text style={styles.paymentOptionDesc}>Pay securely online through VNPay.</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.sectionDivider} />
          <Text style={styles.sectionTitle}>Platform voucher</Text>
          <View style={styles.card}>
            {appliedVoucher == null ? (
              <View style={styles.voucherContainer}>
                <View style={styles.voucherInputRow}>
                  <TextInput
                    style={[styles.voucherInput, voucherError != null && styles.voucherInputError]}
                    value={voucherInput}
                    onChangeText={(text) => {
                      setVoucherInput(text);
                      if (voucherError != null) setVoucherError(null);
                    }}
                    placeholder="Enter voucher code…"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!busy && !isValidatingVoucher}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void handleApplyVoucher();
                    }}
                    accessibilityLabel="Voucher code input"
                  />
                  <Button
                    title="Apply"
                    onPress={() => {
                      void handleApplyVoucher();
                    }}
                    loading={isValidatingVoucher}
                    disabled={busy || isValidatingVoucher}
                    style={styles.voucherApplyButton}
                    accessibilityLabel="Apply voucher"
                  />
                </View>
                {voucherError != null && (
                  <Text style={styles.voucherErrorText}>{voucherError}</Text>
                )}
                {suggestedVouchers.map((voucher, index) => (
                  <VoucherRow
                    key={voucher.code}
                    voucher={voucher}
                    badge={index === 0 ? BEST_VOUCHER_LABEL : undefined}
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
                    accessibilityLabel="View all vouchers"
                  >
                    <Text style={styles.viewAllVouchersText}>View all</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.appliedVoucherCard}>
                <View style={styles.appliedVoucherLeft}>
                  <View style={styles.appliedVoucherBadge}>
                    <Text style={styles.appliedVoucherCode}>{appliedVoucher.code}</Text>
                    <Text style={styles.appliedVoucherPercent}>-{appliedVoucher.discountPercent}%</Text>
                  </View>
                  {appliedVoucher.description ? (
                    <Text style={styles.appliedVoucherDesc} numberOfLines={2}>
                      {appliedVoucher.description}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleRemoveVoucher}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.removeVoucherButton,
                    pressed && styles.removeVoucherButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Remove voucher"
                >
                  <Text style={styles.removeVoucherText}>Remove</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.sectionDivider} />
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
              <Text style={estimatedDiscount > 0 ? styles.discountValue : styles.rowValue}>
                {estimatedDiscount > 0 ? `-${formatVND(estimatedDiscount)}` : formatVND(0)}
              </Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Estimated total</Text>
              <Text style={styles.totalValue}>{formatVND(estimatedTotal)}</Text>
            </View>
          </View>

          {formError != null && <Text style={styles.formError}>{formError}</Text>}

          <Button
            title={paymentMethod === 'VNPAY' ? 'Proceed to VNPay' : 'Place Order'}
            onPress={() => {
              void handlePlaceOrder();
            }}
            loading={busy}
            disabled={busy}
            fullWidth
            accessibilityLabel={paymentMethod === 'VNPAY' ? 'Proceed to VNPay' : 'Place Order'}
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
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
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
  discountValue: {
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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

  checkoutKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.primary },
  checkoutTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  successCircle: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#18B65B', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },

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
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FFFFFF',
  },
  voucherInputError: {
    borderColor: colors.danger,
  },
  voucherApplyButton: {
    minWidth: 84,
  },
  voucherErrorText: {
    fontSize: 12,
    color: colors.danger,
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
    color: colors.primary,
  },
  appliedVoucherPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  appliedVoucherDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  removeVoucherButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeVoucherButtonPressed: {
    opacity: 0.7,
  },
  removeVoucherText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
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
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
  },
  paymentOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F8FAFC',
  },
  paymentOptionPressed: {
    opacity: 0.7,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioCircleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  paymentOptionInfo: {
    flex: 1,
    gap: 2,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  paymentOptionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
