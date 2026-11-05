/**
 * Horizontal filter bar for Seller Shipment statuses (Phase 5).
 *
 * Supports the 7 backend ShipmentStatus values:
 * - PENDING
 * - PREPARING
 * - SHIPPED
 * - DELIVERED
 * - FAILED
 * - RETURNED
 * - CANCELLED
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { ShipmentStatus } from '../../types/sellerApi';

export type SellerShipmentFiltersProps = {
  currentStatus: ShipmentStatus;
  onSelectStatus: (status: ShipmentStatus) => void;
  disabled?: boolean;
};

type StatusOption = {
  status: ShipmentStatus;
  label: string;
};

const SHIPMENT_STATUS_OPTIONS: StatusOption[] = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'PREPARING', label: 'Preparing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
  { status: 'FAILED', label: 'Failed' },
  { status: 'RETURNED', label: 'Returned' },
  { status: 'CANCELLED', label: 'Cancelled' },
];

export default function SellerShipmentFilters({
  currentStatus,
  onSelectStatus,
  disabled = false,
}: SellerShipmentFiltersProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SHIPMENT_STATUS_OPTIONS.map(({ status, label }) => {
          const isSelected = currentStatus === status;
          const displayLabel = t(`seller.shipmentStatus_${status}`, label);
          return (
            <Pressable
              key={status}
              onPress={() => onSelectStatus(status)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.tab,
                { backgroundColor: theme.surface, borderColor: theme.border },
                isSelected && [styles.tabActive, { backgroundColor: theme.primary, borderColor: theme.primary }],
                pressed && !disabled && styles.tabPressed,
                disabled && styles.tabDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Filter by shipment ${label}`}
              accessibilityState={{ selected: isSelected, disabled }}
              testID={`shipment-filter-${status.toLowerCase()}`}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: theme.text },
                  isSelected && [styles.tabTextActive, { color: theme.onPrimary }],
                ]}
              >
                {displayLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  tabTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
