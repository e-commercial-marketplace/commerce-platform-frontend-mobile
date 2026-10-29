import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';

import { colors, radii, spacing } from '../constants/theme';
import { useConfirmReceived, useOrderDetail } from '../hooks/useOrders';
import { useRetryPayment } from '../hooks/usePayment';
import { formatVND } from '../utils/format';
import { markPaymentUrlHandled } from '../utils/paymentDeepLink';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { OrderItemResponse, OrderResponse } from '../types/orderApi';
import { ApiError } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import Button from '../components/Button';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import WriteReviewModal from '../components/WriteReviewModal';

/** 24 hours in milliseconds for VNPay expiration rule. */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isPaymentExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  return Date.now() >= createdTime + TWENTY_FOUR_HOURS_MS;
}

export function isPayNowEligible(order: OrderResponse): boolean {
  if (order.paymentMethod !== 'VNPAY') return false;
  if (order.status !== 'PENDING') return false;
  if (order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'REFUNDED') return false;
  if (isPaymentExpired(order.createdAt)) return false;
  return true;
}

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

/** Parses a backend decimal money string for display only. */
function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '-';
  }
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

function ItemRow({
  item,
  canReview,
  onReview,
}: {
  item: OrderItemResponse;
  canReview?: boolean;
  onReview?: () => void;
}) {
  const unitPrice = parseMoney(item.unitPrice);
  const qty = item.quantity || 0;
  const lineTotal = unitPrice * qty;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.productName}
        </Text>
        <Text style={styles.itemMeta}>
          {formatVND(unitPrice)} × {qty}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemTotal}>{formatVND(lineTotal)}</Text>
        {canReview && item.status !== 'CANCELLED' && onReview != null && (
          <Pressable
            style={({ pressed }) => [
              styles.reviewItemButton,
              pressed && styles.reviewItemButtonPressed,
            ]}
            onPress={onReview}
            accessibilityRole="button"
            accessibilityLabel={`Write review for ${item.productName}`}
          >
            <Text style={styles.reviewItemButtonText}>Write Review</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function OrderDetailScreen({ route, navigation }: AppNavigatorScreenProps<'OrderDetail'>) {
  const { orderId, paymentHint: initialPaymentHint } = route.params;
  const { data: order, isLoading, isError, refetch } = useOrderDetail(orderId);
  const confirmMutation = useConfirmReceived();
  const retryPaymentMutation = useRetryPayment();
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<{ productId: string; productName: string } | null>(null);
  const [paymentHint, setPaymentHint] = useState<
    'COMPLETED' | 'FAILED' | 'INVALID' | 'CANCELLED' | undefined
  >(initialPaymentHint);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isRetryingRef = useRef(false);
  const recheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recheckAttemptedRef = useRef(false);

  // Bounded recheck when mounted with COMPLETED hint but backend still reports PENDING
  useEffect(() => {
    if (
      paymentHint === 'COMPLETED' &&
      order &&
      order.paymentMethod === 'VNPAY' &&
      order.paymentStatus === 'PENDING' &&
      !recheckAttemptedRef.current
    ) {
      recheckAttemptedRef.current = true;
      recheckTimerRef.current = setTimeout(() => {
        void refetch();
      }, 2500);
    }
    return () => {
      if (recheckTimerRef.current) {
        clearTimeout(recheckTimerRef.current);
      }
    };
  }, [paymentHint, order?.paymentStatus, order?.paymentMethod, refetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePayNow = async () => {
    if (isRetryingRef.current || isRetrying || !order) {
      return;
    }
    isRetryingRef.current = true;
    setIsRetrying(true);
    setRetryError(null);

    try {
      const response = await retryPaymentMutation.mutateAsync(order.id);

      if (!response.paymentUrl || response.paymentUrl.trim().length === 0) {
        setRetryError('Payment URL unavailable. Please try again later.');
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(order.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.lists,
        });
        void refetch();
        return;
      }

      let authResult: WebBrowser.WebBrowserAuthSessionResult;
      try {
        authResult = await WebBrowser.openAuthSessionAsync(
          response.paymentUrl,
          'marketplace://payment-result',
        );
      } catch {
        setPaymentHint('FAILED');
        setRetryError('Failed to open payment browser. Please try again.');
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(order.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.lists,
        });
        void refetch();
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(order.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.lists,
      });

      if (authResult.type === 'success' && authResult.url) {
        markPaymentUrlHandled(authResult.url);
        const parsed = parseRedirectUrl(authResult.url);
        const nextHint = parsed.status || 'COMPLETED';
        setPaymentHint(nextHint);
        const refreshed = await refetch();
        if (nextHint === 'COMPLETED' && refreshed.data?.paymentStatus === 'PENDING') {
          if (recheckTimerRef.current) {
            clearTimeout(recheckTimerRef.current);
          }
          recheckTimerRef.current = setTimeout(() => {
            void refetch();
          }, 2500);
        }
      } else {
        setPaymentHint('CANCELLED');
        void refetch();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'ORDER_NOT_PAYABLE') {
          setRetryError('This order can no longer be paid.');
        } else {
          setRetryError(err.message || 'Payment retry failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setRetryError(err.message || 'Payment retry failed. Please try again.');
      } else {
        setRetryError('Payment retry failed. Please try again.');
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(order.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.lists,
      });
      void refetch();
    } finally {
      isRetryingRef.current = false;
      setIsRetrying(false);
    }
  };

  const handleConfirm = () => {
    if (!order || confirmMutation.isPending) {
      return;
    }
    Alert.alert('Confirm received', 'Are you sure you have received this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => {
          setConfirming(true);
          confirmMutation.mutate(orderId, {
            onSettled: () => {
              setConfirming(false);
            },
            onError: (err) => {
              if (err instanceof ApiError) {
                if (err.status === 404) {
                  Alert.alert('Not found', 'Order not found or not accessible.');
                } else if (err.status === 400) {
                  Alert.alert('Cannot confirm', err.message || 'This order cannot be confirmed.');
                  void refetch();
                } else {
                  Alert.alert('Error', err.message || 'Failed to confirm received.');
                }
              } else {
                Alert.alert('Error', 'Failed to confirm received.');
              }
            },
          });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Couldn't load order</Text>
          <Text style={styles.subtitle}>The order may not exist or you don't have access.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showConfirm = order.status === 'DELIVERED';
  const isPendingMutation = confirmMutation.isPending || confirming;
  const isExpired = isPaymentExpired(order.createdAt);
  const canPayNow = isPayNowEligible(order);

  // Compute VNPay banner only for VNPAY orders
  let vnpayBanner: {
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    description: string;
  } | null = null;

  if (order.paymentMethod === 'VNPAY') {
    if (order.paymentStatus === 'COMPLETED') {
      vnpayBanner = {
        type: 'success',
        title: 'Payment successful',
        description: 'Your payment via VNPay has been confirmed.',
      };
    } else if (order.paymentStatus === 'REFUNDED') {
      vnpayBanner = {
        type: 'info',
        title: 'Refunded',
        description: 'This payment has been refunded.',
      };
    } else if (isExpired) {
      vnpayBanner = {
        type: 'warning',
        title: 'Payment expired',
        description: 'The 24-hour payment window has expired. This order can no longer be paid.',
      };
    } else if (order.paymentStatus === 'FAILED') {
      vnpayBanner = {
        type: 'danger',
        title: 'Payment not completed',
        description: 'Payment was not successful. You can retry payment while this order is still payable.',
      };
    } else if (paymentHint === 'COMPLETED') {
      vnpayBanner = {
        type: 'info',
        title: 'Checking payment status…',
        description: 'Payment returned successfully. Checking order status…',
      };
    } else if (paymentHint === 'CANCELLED') {
      vnpayBanner = {
        type: 'warning',
        title: 'Payment cancelled',
        description: 'Payment was cancelled. You can retry while this order is still payable.',
      };
    } else if (paymentHint === 'FAILED') {
      vnpayBanner = {
        type: 'danger',
        title: 'Payment not completed',
        description: 'VNPay reported that payment was not completed.',
      };
    } else if (paymentHint === 'INVALID') {
      vnpayBanner = {
        type: 'warning',
        title: 'Payment unverified',
        description: 'Payment result could not be verified. Checking order status…',
      };
    } else {
      vnpayBanner = {
        type: 'warning',
        title: 'Payment pending',
        description: 'Please complete payment within 24 hours of placing your order.',
      };
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Order ID</Text>
            <Text style={styles.value} numberOfLines={1}>
              {order.id}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{order.status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Created</Text>
            <Text style={styles.value}>{formatDate(order.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>{order.paymentMethod}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{order.paymentStatus}</Text>
          </View>

          {vnpayBanner != null && (
            <View
              style={[
                styles.paymentBanner,
                vnpayBanner.type === 'success' && styles.paymentBannerSuccess,
                vnpayBanner.type === 'warning' && styles.paymentBannerWarning,
                vnpayBanner.type === 'danger' && styles.paymentBannerDanger,
                vnpayBanner.type === 'info' && styles.paymentBannerInfo,
              ]}
            >
              <Text
                style={[
                  styles.paymentBannerTitle,
                  vnpayBanner.type === 'success' && styles.paymentBannerTitleSuccess,
                  vnpayBanner.type === 'warning' && styles.paymentBannerTitleWarning,
                  vnpayBanner.type === 'danger' && styles.paymentBannerTitleDanger,
                  vnpayBanner.type === 'info' && styles.paymentBannerTitleInfo,
                ]}
              >
                {vnpayBanner.title}
              </Text>
              <Text
                style={[
                  styles.paymentBannerDesc,
                  vnpayBanner.type === 'success' && styles.paymentBannerDescSuccess,
                  vnpayBanner.type === 'warning' && styles.paymentBannerDescWarning,
                  vnpayBanner.type === 'danger' && styles.paymentBannerDescDanger,
                  vnpayBanner.type === 'info' && styles.paymentBannerDescInfo,
                ]}
              >
                {vnpayBanner.description}
              </Text>
            </View>
          )}

          {canPayNow && (
            <View style={styles.payNowContainer}>
              <Button
                title="Pay Now"
                onPress={() => {
                  void handlePayNow();
                }}
                loading={isRetrying}
                disabled={isRetrying}
                fullWidth
                accessibilityLabel="Pay Now"
              />
            </View>
          )}

          {retryError != null && (
            <Text style={styles.retryErrorText}>{retryError}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.address}>{order.shippingAddress}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              canReview={order.status === 'COMPLETED'}
              onReview={() =>
                setReviewingItem({
                  productId: item.productId,
                  productName: item.productName,
                })
              }
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totals</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Shipping Fee</Text>
            <Text style={styles.value}>{formatVND(parseMoney(order.shippingFee))}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Discount</Text>
            <Text style={styles.value}>{formatVND(parseMoney(order.discountAmount))}</Text>
          </View>
          {order.voucherCode ? (
            <View style={styles.row}>
              <Text style={styles.label}>Voucher</Text>
              <Text style={styles.value}>{order.voucherCode}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatVND(parseMoney(order.totalAmount))}</Text>
          </View>
        </View>

        {order.shipments && order.shipments.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipment Tracking</Text>
            {order.shipments.map((shipment, index) => (
              <ShipmentTimeline
                key={shipment.id}
                shipment={shipment}
                index={index}
                orderItems={order.items}
              />
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shipment Tracking</Text>
            <Text style={styles.subtitle}>Shipment information is not available yet.</Text>
          </View>
        )}

        {showConfirm ? (
          <Pressable
            onPress={handleConfirm}
            disabled={isPendingMutation}
            style={({ pressed }) => [
              styles.confirmButton,
              (pressed || isPendingMutation) && styles.buttonPressed,
            ]}
          >
            {isPendingMutation ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm Received</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      {reviewingItem != null && (
        <WriteReviewModal
          visible={true}
          productId={reviewingItem.productId}
          productName={reviewingItem.productName}
          onClose={() => setReviewingItem(null)}
        />
      )}
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
    gap: spacing.md,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  address: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  reviewItemButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  reviewItemButtonPressed: {
    opacity: 0.8,
  },
  reviewItemButtonText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  paymentBanner: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  paymentBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  paymentBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  paymentBannerDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  paymentBannerInfo: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  paymentBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentBannerTitleSuccess: {
    color: '#166534',
  },
  paymentBannerTitleWarning: {
    color: '#92400E',
  },
  paymentBannerTitleDanger: {
    color: '#991B1B',
  },
  paymentBannerTitleInfo: {
    color: '#075985',
  },
  paymentBannerDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  paymentBannerDescSuccess: {
    color: '#15803D',
  },
  paymentBannerDescWarning: {
    color: '#B45309',
  },
  paymentBannerDescDanger: {
    color: '#B91C1C',
  },
  paymentBannerDescInfo: {
    color: '#0369A1',
  },
  payNowContainer: {
    marginTop: spacing.xs,
  },
  retryErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
