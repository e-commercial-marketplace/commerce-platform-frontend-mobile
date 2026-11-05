import { StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';
import type { OrderItemResponse, ShipmentResponse } from '../types/orderApi';
import { formatVND } from '../utils/format';

const NORMAL_STEPS: ShipmentResponse['status'][] = ['PENDING', 'PREPARING', 'SHIPPED', 'DELIVERED'];

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function getStepIndex(status: ShipmentResponse['status']): number {
  const idx = NORMAL_STEPS.indexOf(status);
  if (idx >= 0) {
    return idx;
  }
  return -1;
}

export type ShipmentTimelineProps = {
  shipment: ShipmentResponse;
  index: number;
  orderItems?: OrderItemResponse[];
};

export function ShipmentTimeline({ shipment, index, orderItems = [] }: ShipmentTimelineProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  const stepIndex = getStepIndex(shipment.status);
  const isException = stepIndex === -1;
  const shippedAt = formatDateTime(shipment.shippedAt);
  const deliveredAt = formatDateTime(shipment.deliveredAt);

  const getDeliveryMethodLabel = (method: ShipmentResponse['deliveryMethod']): string => {
    if (method === 'PLATFORM_DELIVERY') {
      return t('orders.deliveryMethod_PLATFORM_DELIVERY', 'Platform delivery');
    }
    if (method === 'SELF_DELIVERY') {
      return t('orders.deliveryMethod_SELF_DELIVERY', 'Seller delivery');
    }
    return method;
  };

  const localizedStatus = t(`orders.status_${shipment.status}`, shipment.status);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('orders.shipmentCount', `Shipment ${index + 1}`, { index: index + 1 })}
        </Text>
        <Text style={[styles.status, { color: theme.primary }]}>{localizedStatus}</Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.method', 'Method')}
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {getDeliveryMethodLabel(shipment.deliveryMethod)}
        </Text>
      </View>

      {shipment.carrier ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {t('orders.carrier', 'Carrier')}
          </Text>
          <Text style={[styles.value, { color: theme.text }]}>{shipment.carrier.name}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.trackingCode', 'Tracking code')}
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {shipment.trackingCode
            ? shipment.trackingCode
            : t('orders.trackingCodeUnavailable', 'Tracking code not available yet')}
        </Text>
      </View>

      {shippedAt ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {t('orders.shippedAt', 'Shipped')}
          </Text>
          <Text style={[styles.value, { color: theme.text }]}>{shippedAt}</Text>
        </View>
      ) : null}

      {deliveredAt ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            {t('orders.deliveredAt', 'Delivered')}
          </Text>
          <Text style={[styles.value, { color: theme.text }]}>{deliveredAt}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.shippingFee', 'Shipping fee')}
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {formatVND(parseMoney(shipment.shippingFee))}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {isException ? (
        <View
          style={[
            styles.exceptionBox,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
            },
          ]}
        >
          <Text style={[styles.exceptionTitle, { color: theme.danger }]}>
            {shipment.status === 'CANCELLED'
              ? t('orders.shipmentCancelled', 'Shipment cancelled')
              : shipment.status === 'RETURNED'
                ? t('orders.shipmentReturned', 'Shipment returned')
                : t('orders.shipmentIssue', 'Shipment issue')}
          </Text>
          <Text style={[styles.exceptionText, { color: theme.danger }]}>
            {shipment.status === 'FAILED'
              ? t(
                  'orders.deliveryFailedDesc',
                  'Delivery attempt failed. The package may be returned to the seller.',
                )
              : shipment.status === 'RETURNED'
                ? t('orders.shipmentReturnedDesc', 'This shipment has been returned.')
                : t('orders.shipmentCancelledDesc', 'This shipment has been cancelled.')}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {NORMAL_STEPS.map((step, i) => {
            const completed = i <= stepIndex;
            const current = i === stepIndex;
            const stepLabel = t(`orders.status_${step}`, step);

            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineIndicatorCol}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: theme.border, backgroundColor: theme.surface },
                      completed && [styles.dotCompleted, { backgroundColor: theme.primary, borderColor: theme.primary }],
                      current && [styles.dotCurrent, { borderColor: theme.primary }],
                    ]}
                  />
                  {i < NORMAL_STEPS.length - 1 ? (
                    <View
                      style={[
                        styles.line,
                        { backgroundColor: theme.border },
                        completed && i < stepIndex && [styles.lineCompleted, { backgroundColor: theme.primary }],
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.stepLabel,
                      { color: theme.textSecondary },
                      completed && [styles.stepLabelCompleted, { color: theme.text }],
                      current && [styles.stepLabelCurrent, { color: theme.primary }],
                    ]}
                  >
                    {stepLabel}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {shipment.items && shipment.items.length > 0 ? (
        <View style={styles.itemsSection}>
          <Text style={[styles.itemsTitle, { color: theme.text }]}>
            {t('orders.shipmentItems', 'Shipment items')}
          </Text>
          {shipment.items.map((item) => {
            const orderItem = orderItems.find((oi) => oi.id === item.orderItemId);
            const name = orderItem ? orderItem.productName : 'Item';
            return (
              <Text key={item.orderItemId} style={[styles.itemText, { color: theme.textSecondary }]}>
                {name} × {item.quantity}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
    textAlign: 'right',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  timeline: {
    gap: 0,
    marginVertical: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 32,
  },
  timelineIndicatorCol: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    zIndex: 1,
  },
  dotCompleted: {},
  dotCurrent: {},
  line: {
    width: 2,
    flex: 1,
    marginVertical: -2,
  },
  lineCompleted: {},
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.sm,
    justifyContent: 'center',
    paddingBottom: spacing.xs,
  },
  stepLabel: {
    fontSize: 12,
  },
  stepLabelCompleted: {
    fontWeight: '600',
  },
  stepLabelCurrent: {
    fontWeight: '700',
  },
  itemsSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    gap: 2,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemText: {
    fontSize: 12,
  },
  exceptionBox: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 4,
    marginVertical: spacing.xs,
  },
  exceptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  exceptionText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
