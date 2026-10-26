import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';
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

function getDeliveryMethodLabel(method: ShipmentResponse['deliveryMethod']): string {
  if (method === 'PLATFORM_DELIVERY') {
    return 'Platform delivery';
  }
  if (method === 'SELF_DELIVERY') {
    return 'Seller delivery';
  }
  return method;
}

export type ShipmentTimelineProps = {
  shipment: ShipmentResponse;
  index: number;
  orderItems?: OrderItemResponse[];
};

export function ShipmentTimeline({ shipment, index, orderItems = [] }: ShipmentTimelineProps) {
  const stepIndex = getStepIndex(shipment.status);
  const isException = stepIndex === -1;
  const shippedAt = formatDateTime(shipment.shippedAt);
  const deliveredAt = formatDateTime(shipment.deliveredAt);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Shipment {index + 1}</Text>
        <Text style={styles.status}>{shipment.status}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Method</Text>
        <Text style={styles.value}>{getDeliveryMethodLabel(shipment.deliveryMethod)}</Text>
      </View>

      {shipment.carrier ? (
        <View style={styles.row}>
          <Text style={styles.label}>Carrier</Text>
          <Text style={styles.value}>{shipment.carrier.name}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Tracking code</Text>
        <Text style={styles.value}>{shipment.trackingCode ? shipment.trackingCode : 'Tracking code not available yet'}</Text>
      </View>

      {shippedAt ? (
        <View style={styles.row}>
          <Text style={styles.label}>Shipped</Text>
          <Text style={styles.value}>{shippedAt}</Text>
        </View>
      ) : null}

      {deliveredAt ? (
        <View style={styles.row}>
          <Text style={styles.label}>Delivered</Text>
          <Text style={styles.value}>{deliveredAt}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Shipping fee</Text>
        <Text style={styles.value}>{formatVND(parseMoney(shipment.shippingFee))}</Text>
      </View>

      <View style={styles.divider} />

      {isException ? (
        <View style={styles.exceptionBox}>
          <Text style={styles.exceptionTitle}>
            {shipment.status === 'CANCELLED'
              ? 'Shipment cancelled'
              : shipment.status === 'RETURNED'
                ? 'Shipment returned'
                : 'Shipment issue'}
          </Text>
          <Text style={styles.exceptionText}>
            {shipment.status === 'FAILED'
              ? 'Delivery attempt failed. The package may be returned to the seller.'
              : shipment.status === 'RETURNED'
                ? 'This shipment has been returned.'
                : 'This shipment has been cancelled.'}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {NORMAL_STEPS.map((step, i) => {
            const completed = i <= stepIndex;
            const current = i === stepIndex;
            return (
              <View key={step} style={styles.timelineRow}>
                <View style={styles.timelineIndicatorCol}>
                  <View style={[styles.dot, completed && styles.dotCompleted, current && styles.dotCurrent]} />
                  {i < NORMAL_STEPS.length - 1 ? <View style={[styles.line, completed && i < stepIndex && styles.lineCompleted]} /> : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.stepLabel, completed && styles.stepLabelCompleted, current && styles.stepLabelCurrent]}>
                    {step}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {shipment.items && shipment.items.length > 0 ? (
        <View style={styles.itemsSection}>
          <Text style={styles.itemsTitle}>Shipment items</Text>
          {shipment.items.map((item) => {
            const orderItem = orderItems.find((oi) => oi.id === item.orderItemId);
            const name = orderItem ? orderItem.productName : 'Item';
            return (
              <Text key={item.orderItemId} style={styles.itemText}>
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
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  timeline: {
    gap: 0,
    marginTop: spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineIndicatorCol: {
    alignItems: 'center',
    width: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 2,
  },
  dotCompleted: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  stepLabelCompleted: {
    color: colors.text,
  },
  stepLabelCurrent: {
    color: colors.text,
    fontWeight: '700',
  },
  exceptionBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
  },
  exceptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  exceptionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemsSection: {
    marginTop: spacing.xs,
    gap: 2,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  itemText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
