import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../constants/theme';
import { useConfirmReceived, useOrderDetail } from '../hooks/useOrders';
import { formatVND } from '../utils/format';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { OrderItemResponse } from '../types/orderApi';
import { ApiError } from '../api/errors';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import WriteReviewModal from '../components/WriteReviewModal';

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
  const { orderId } = route.params;
  const { data: order, isLoading, isError, refetch } = useOrderDetail(orderId);
  const confirmMutation = useConfirmReceived();
  const [confirming, setConfirming] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<{ productId: string; productName: string } | null>(null);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
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
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    marginTop: 2,
  },
  reviewItemButtonPressed: {
    opacity: 0.7,
  },
  reviewItemButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  confirmButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
