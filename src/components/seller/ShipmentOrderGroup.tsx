/**
 * Group of CONFIRMED order items belonging to a single order.
 *
 * Backend business rule:
 * ONE SHIPMENT PER SELLER PER ORDER.
 *
 * This component bundles all eligible confirmed items for the order so the seller
 * creates a single complete shipment rather than an irreversible partial shipment.
 *
 * Items within the group can also be cancelled individually if needed before shipment creation.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { SellerOrderItem } from '../../types/sellerApi';
import { formatVND } from '../../utils/format';

type ShipmentOrderGroupProps = {
  orderId: string;
  items: SellerOrderItem[];
  onCreateShipment: (orderId: string, items: SellerOrderItem[]) => void;
  onCancelItem: (item: SellerOrderItem) => void;
  disabled?: boolean;
};

export default function ShipmentOrderGroup({
  orderId,
  items,
  onCreateShipment,
  onCancelItem,
  disabled = false,
}: ShipmentOrderGroupProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + (Number.parseFloat(item.unitPrice) || 0) * item.quantity,
    0,
  );

  return (
    <View
      style={[styles.groupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`order-group-${orderId}`}
    >
      {/* Order Header with Action */}
      <View style={styles.groupHeader}>
        <View style={styles.orderMeta}>
          <Text style={[styles.orderLabel, { color: theme.textSecondary }]}>
            {t('orders.order', 'Order')}
          </Text>
          <Text style={[styles.orderId, { color: theme.text }]} numberOfLines={1}>
            #{orderId.slice(0, 8)}
          </Text>
          <View
            style={[
              styles.itemBadge,
              {
                backgroundColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#F3F4F6',
              },
            ]}
          >
            <Text style={[styles.itemBadgeText, { color: theme.textSecondary }]}>
              {items.length} {items.length === 1 ? 'line' : 'lines'} ({totalQuantity} pcs)
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => onCreateShipment(orderId, items)}
          disabled={disabled || items.length === 0}
          style={({ pressed }) => [
            styles.createShipmentBtn,
            { backgroundColor: theme.primary },
            pressed && !disabled && styles.btnPressed,
            (disabled || items.length === 0) && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Create Shipment for Order #${orderId.slice(0, 8)}`}
        >
          <Text style={[styles.createShipmentBtnText, { color: theme.onPrimary }]}>
            {t('seller.createShipment', 'Create Shipment')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Items list belonging to this order */}
      <View style={styles.itemsList}>
        {items.map((item) => {
          const unitPriceNum = Number.parseFloat(item.unitPrice) || 0;
          const lineTotal = unitPriceNum * item.quantity;

          return (
            <View key={item.id} style={styles.itemRow} testID={`order-item-${item.id}`}>
              <View style={styles.itemInfo}>
                <Text style={[styles.productName, { color: theme.text }]} numberOfLines={1}>
                  {item.productName}
                </Text>
                <Text style={[styles.itemPricing, { color: theme.textSecondary }]}>
                  Qty: {item.quantity} • {formatVND(unitPriceNum)} = {formatVND(lineTotal)}
                </Text>
              </View>

              <Pressable
                onPress={() => onCancelItem(item)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.cancelItemBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && !disabled && styles.btnPressed,
                  disabled && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${item.productName}`}
              >
                <Text style={[styles.cancelItemBtnText, { color: theme.danger }]}>
                  {t('seller.cancel', 'Cancel')}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Footer order total */}
      <View style={styles.groupFooter}>
        <Text style={[styles.footerLabel, { color: theme.textSecondary }]}>
          {t('seller.orderGroupHeader', 'Order Bundle Total:')}
        </Text>
        <Text style={[styles.footerTotal, { color: theme.text }]}>{formatVND(totalAmount)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
  itemBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  itemBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: '#15803D',
  },
  createShipmentBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createShipmentBtnText: {
    color: colors.onPrimary,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  itemPricing: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  cancelItemBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelItemBtnText: {
    color: colors.danger,
    fontSize: typography.xs,
    fontWeight: '700',
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footerTotal: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.primary,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
