/**
 * Seller Order Item Card.
 *
 * Displays a single order line belonging to the authenticated seller.
 * Shows only authoritative backend fields from SellerOrderItem:
 * - productName
 * - quantity
 * - unitPrice (formatted VND)
 * - status
 * - orderId (shortened visual reference)
 *
 * Actions:
 * - PENDING: Confirm & Cancel buttons
 * - CONFIRMED: Cancel button (subject to backend validation before shipment)
 * - CANCELLED: Status only, no actions
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { OrderItemStatus, SellerOrderItem } from '../../types/sellerApi';
import { formatVND } from '../../utils/format';

type SellerOrderItemCardProps = {
  item: SellerOrderItem;
  onConfirm: (item: SellerOrderItem) => void;
  onCancel: (item: SellerOrderItem) => void;
  isConfirming?: boolean;
  isCancelling?: boolean;
  actionDisabled?: boolean;
};

const STATUS_CONFIG: Record<
  OrderItemStatus,
  { label: string; textColor: string; bgColor: string }
> = {
  PENDING: {
    label: 'Pending',
    textColor: '#B45309',
    bgColor: '#FEF3C7',
  },
  CONFIRMED: {
    label: 'Confirmed',
    textColor: '#15803D',
    bgColor: '#DCFCE7',
  },
  CANCELLED: {
    label: 'Cancelled',
    textColor: '#B91C1C',
    bgColor: '#FEE2E2',
  },
};

export default function SellerOrderItemCard({
  item,
  onConfirm,
  onCancel,
  isConfirming = false,
  isCancelling = false,
  actionDisabled = false,
}: SellerOrderItemCardProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const numericPrice = Number.parseFloat(item.unitPrice) || 0;
  const lineTotal = numericPrice * item.quantity;
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
  const isBusy = isConfirming || isCancelling || actionDisabled;

  const dynamicStatusBadge = (() => {
    if (isDark) {
      switch (item.status) {
        case 'CONFIRMED':
          return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80' };
        case 'CANCELLED':
          return { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171' };
        default:
          return { bg: 'rgba(245, 158, 11, 0.2)', text: '#FBBF24' };
      }
    }
    return { bg: statusCfg.bgColor, text: statusCfg.textColor };
  })();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.orderRefRow}>
          <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
            {t('orders.order', 'Order')}
          </Text>
          <Text style={[styles.orderId, { color: theme.text }]} numberOfLines={1}>
            #{item.orderId.slice(0, 8)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: dynamicStatusBadge.bg }]}>
          <Text style={[styles.statusText, { color: dynamicStatusBadge.text }]}>
            {t(`seller.itemStatus_${item.status}`, statusCfg.label)}
          </Text>
        </View>
      </View>

      <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

      <View style={styles.productDetails}>
        <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
          {item.productName}
        </Text>
        <View style={styles.priceQuantityRow}>
          <Text style={[styles.quantityText, { color: theme.textSecondary }]}>
            Qty: {item.quantity}
          </Text>
          <Text style={[styles.unitPriceText, { color: theme.textSecondary }]}>
            {formatVND(numericPrice)} / item
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
            {t('orders.total', 'Line Total:')}
          </Text>
          <Text style={[styles.totalAmount, { color: theme.text }]}>{formatVND(lineTotal)}</Text>
        </View>
      </View>

      {item.status !== 'CANCELLED' ? (
        <View style={styles.actionsRow}>
          {item.status === 'PENDING' ? (
            <Pressable
              onPress={() => onConfirm(item)}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: theme.primary },
                pressed && !isBusy && styles.buttonPressed,
                isBusy && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Confirm ${item.productName}`}
            >
              {isConfirming ? (
                <View style={styles.buttonInnerRow}>
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                  <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>Confirming...</Text>
                </View>
              ) : (
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>
                  {t('seller.confirmItem', 'Confirm Item')}
                </Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => onCancel(item)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && !isBusy && styles.buttonPressed,
              isBusy && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ${item.productName}`}
          >
            <Text style={[styles.cancelButtonText, { color: theme.danger }]}>
              {t('seller.cancelItem', 'Cancel Item')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  orderId: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  productDetails: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  productName: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  unitPriceText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confirmButtonText: {
    color: colors.onPrimary,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  cancelButtonText: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
