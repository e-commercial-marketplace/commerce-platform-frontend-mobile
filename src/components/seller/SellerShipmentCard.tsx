/**
 * Card displaying an individual Seller Shipment (Phase 5).
 *
 * Implements:
 * - Shipment metadata (order reference, shipment reference, status badge, delivery method)
 * - Safe carrier display: shows carrier for PLATFORM_DELIVERY, never fabricates carrier for SELF_DELIVERY
 * - Safe tracking display: shows code only when non-null, never fabricates tracking code
 * - Timestamps: shippedAt and deliveredAt
 * - Line items list with quantity and orderItemId
 * - Shipping fee display
 * - Strict transition actions matching backend state machine NEXT map
 * - Terminal states (DELIVERED, RETURNED, CANCELLED) show no action controls
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { SellerShipment, ShipmentStatus } from '../../types/sellerApi';
import { formatVND } from '../../utils/format';

/**
 * Exact allowed next statuses matching ShipmentServiceImpl.java NEXT map:
 * PENDING -> PREPARING, CANCELLED
 * PREPARING -> SHIPPED, CANCELLED
 * SHIPPED -> DELIVERED, FAILED
 * FAILED -> RETURNED
 * DELIVERED, RETURNED, CANCELLED -> [] (terminal)
 */
export const SHIPMENT_NEXT_STATUSES: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'FAILED'],
  FAILED: ['RETURNED'],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

const STATUS_THEMES: Record<
  ShipmentStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: '#FEF3C7',
    text: '#B45309',
    border: '#FDE68A',
  },
  PREPARING: {
    label: 'Preparing',
    bg: '#EFF6FF',
    text: '#1D4ED8',
    border: '#BFDBFE',
  },
  SHIPPED: {
    label: 'Shipped',
    bg: '#F3E8FF',
    text: '#7E22CE',
    border: '#E9D5FF',
  },
  DELIVERED: {
    label: 'Delivered',
    bg: '#DCFCE7',
    text: '#15803D',
    border: '#BBF7D0',
  },
  FAILED: {
    label: 'Delivery Failed',
    bg: '#FEE2E2',
    text: '#B91C1C',
    border: '#FECACA',
  },
  RETURNED: {
    label: 'Returned',
    bg: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FCA5A5',
  },
};

const ACTION_CONFIGS: Record<
  ShipmentStatus,
  { label: string; isDanger?: boolean; isPrimary?: boolean }
> = {
  PREPARING: { label: 'Start Preparing', isPrimary: true },
  SHIPPED: { label: 'Ship Order', isPrimary: true },
  DELIVERED: { label: 'Mark Delivered', isPrimary: true },
  FAILED: { label: 'Mark Failed', isDanger: true },
  RETURNED: { label: 'Mark Returned' },
  CANCELLED: { label: 'Cancel Shipment', isDanger: true },
  PENDING: { label: 'Pending' },
};

export type SellerShipmentCardProps = {
  shipment: SellerShipment;
  onUpdateStatus: (shipment: SellerShipment, targetStatus: ShipmentStatus) => void;
  disabled?: boolean;
};

function formatDateTime(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

export default function SellerShipmentCard({
  shipment,
  onUpdateStatus,
  disabled = false,
}: SellerShipmentCardProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const statusTheme = STATUS_THEMES[shipment.status] ?? STATUS_THEMES.PENDING;
  const allowedNext = SHIPMENT_NEXT_STATUSES[shipment.status] ?? [];
  const isTerminal = allowedNext.length === 0;

  const shippedTime = formatDateTime(shipment.shippedAt);
  const deliveredTime = formatDateTime(shipment.deliveredAt);

  const totalQuantity = (shipment.items ?? []).reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const shippingFeeNum = Number.parseFloat(shipment.shippingFee) || 0;

  const dynamicStatusTheme = (() => {
    if (isDark) {
      switch (shipment.status) {
        case 'PREPARING':
          return { bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.4)' };
        case 'SHIPPED':
          return { bg: 'rgba(168, 85, 247, 0.2)', text: '#C084FC', border: 'rgba(168, 85, 247, 0.4)' };
        case 'DELIVERED':
          return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.4)' };
        case 'FAILED':
        case 'CANCELLED':
          return { bg: 'rgba(239, 68, 68, 0.2)', text: '#F87171', border: 'rgba(239, 68, 68, 0.4)' };
        case 'RETURNED':
          return { bg: 'rgba(148, 163, 184, 0.2)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.4)' };
        default:
          return { bg: 'rgba(245, 158, 11, 0.2)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.4)' };
      }
    }
    return statusTheme;
  })();

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`shipment-card-${shipment.id}`}
    >
      {/* Top Header: Order & Shipment refs + Status Badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.refRow}>
            <Text style={[styles.refLabel, { color: theme.textSecondary }]}>
              {t('orders.order', 'Order')}
            </Text>
            <Text style={[styles.refValue, { color: theme.text }]}>
              #{shipment.orderId.slice(0, 8)}
            </Text>
          </View>
          <View style={styles.refRow}>
            <Text style={[styles.refLabel, { color: theme.textSecondary }]}>
              {t('orders.shipmentTracking', 'Shipment')}
            </Text>
            <Text style={[styles.refValue, { color: theme.text }]}>
              #{shipment.id.slice(0, 8)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: dynamicStatusTheme.bg, borderColor: dynamicStatusTheme.border },
          ]}
        >
          <Text style={[styles.badgeText, { color: dynamicStatusTheme.text }]}>
            {t(`seller.shipmentStatus_${shipment.status}`, statusTheme.label)}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Delivery & Carrier Info */}
      <View style={styles.metaSection}>
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
            {t('orders.method', 'Delivery Method:')}
          </Text>
          <Text style={[styles.metaValue, { color: theme.text }]}>
            {shipment.deliveryMethod === 'PLATFORM_DELIVERY'
              ? t('seller.deliveryMethod_PLATFORM_DELIVERY', 'Platform Delivery')
              : t('seller.deliveryMethod_SELF_DELIVERY', 'Shop Self Delivery')}
          </Text>
        </View>

        {shipment.deliveryMethod === 'PLATFORM_DELIVERY' && shipment.carrier ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
              {t('orders.carrier', 'Carrier:')}
            </Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{shipment.carrier.name}</Text>
          </View>
        ) : null}

        {shipment.trackingCode ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
              {t('orders.trackingCode', 'Tracking Code:')}
            </Text>
            <Text style={[styles.metaValue, styles.trackingCode, { color: theme.text }]}>
              {shipment.trackingCode}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
            {t('orders.shippingFee', 'Shipping Fee:')}
          </Text>
          <Text style={[styles.metaValue, { color: theme.text }]}>{formatVND(shippingFeeNum)}</Text>
        </View>

        {shippedTime ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
              {t('orders.shippedAt', 'Shipped At:')}
            </Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{shippedTime}</Text>
          </View>
        ) : null}

        {deliveredTime ? (
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
              {t('orders.deliveredAt', 'Delivered At:')}
            </Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{deliveredTime}</Text>
          </View>
        ) : null}
      </View>

      {/* Bundled Items List */}
      <View
        style={[
          styles.itemsSection,
          { backgroundColor: theme.background, borderColor: theme.border },
        ]}
      >
        <View style={styles.itemsHeader}>
          <Text style={[styles.itemsCountText, { color: theme.textSecondary }]}>
            {t(
              'seller.bundledItemsSummary',
              `Bundled Items (${shipment.items?.length ?? 0} line${shipment.items?.length === 1 ? '' : 's'}, ${totalQuantity} pcs)`,
              { lines: shipment.items?.length ?? 0, pieces: totalQuantity },
            )}
          </Text>
        </View>

        {(shipment.items ?? []).map((item) => (
          <View key={item.orderItemId} style={styles.itemRow}>
            <Text style={[styles.itemRef, { color: theme.text }]}>
              {t('seller.itemReference', `Item #${item.orderItemId.slice(0, 8)}`, { id: item.orderItemId.slice(0, 8) })}
            </Text>
            <Text style={[styles.itemQty, { color: theme.textSecondary }]}>
              {t('seller.itemQuantity', `Qty: ${item.quantity}`, { quantity: item.quantity })}
            </Text>
          </View>
        ))}
      </View>

      {/* Status Transition Action Buttons (Hidden for terminal states) */}
      {!isTerminal ? (
        <View style={[styles.actionsFooter, { borderTopColor: theme.border }]}>
          {allowedNext.map((target) => {
            const config = ACTION_CONFIGS[target] ?? { label: target };
            const actionLabel = t(`seller.shipmentAction_${target}`, config.label);
            const shipmentRef = shipment.id.slice(0, 8);
            return (
              <Pressable
                key={target}
                onPress={() => onUpdateStatus(shipment, target)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  config.isPrimary && [styles.actionBtnPrimary, { backgroundColor: theme.primary }],
                  config.isDanger && [
                    styles.actionBtnDanger,
                    isDark && {
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                    },
                  ],
                  pressed && !disabled && styles.btnPressed,
                  disabled && styles.btnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('seller.shipmentActionAccessibility', `${actionLabel} for Shipment #${shipmentRef}`, {
                  action: actionLabel,
                  id: shipmentRef,
                })}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: theme.text },
                    config.isPrimary && [styles.actionBtnTextPrimary, { color: theme.onPrimary }],
                    config.isDanger && [styles.actionBtnTextDanger, { color: theme.danger }],
                  ]}
                >
                  {actionLabel}
                </Text>
              </Pressable>
            );
          })}
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
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    gap: 2,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  refLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  refValue: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  metaSection: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  trackingCode: {
    fontWeight: '700',
    color: colors.primary,
  },
  itemsSection: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  itemsHeader: {
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  itemsCountText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  itemRef: {
    fontSize: typography.xs,
    color: colors.text,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  actionsFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBtnDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.background,
  },
  actionBtnText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
  },
  actionBtnTextPrimary: {
    color: colors.onPrimary,
  },
  actionBtnTextDanger: {
    color: colors.danger,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
