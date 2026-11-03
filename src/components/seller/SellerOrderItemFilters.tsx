/**
 * Segmented filter bar for Seller Order Items status.
 *
 * Supported backend statuses:
 * - PENDING: newly placed order items awaiting seller confirmation
 * - CONFIRMED: accepted items eligible for shipment
 * - CANCELLED: items rejected or cancelled
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { OrderItemStatus } from '../../types/sellerApi';

type StatusOption = {
  status: OrderItemStatus;
  label: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'CANCELLED', label: 'Cancelled' },
];

type SellerOrderItemFiltersProps = {
  currentStatus: OrderItemStatus;
  onSelectStatus: (status: OrderItemStatus) => void;
  disabled?: boolean;
};

export default function SellerOrderItemFilters({
  currentStatus,
  onSelectStatus,
  disabled = false,
}: SellerOrderItemFiltersProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {STATUS_OPTIONS.map((option) => {
        const isSelected = currentStatus === option.status;
        const displayLabel = t(`seller.itemStatus_${option.status}`, option.label);
        return (
          <Pressable
            key={option.status}
            onPress={() => onSelectStatus(option.status)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected, disabled }}
            style={({ pressed }) => [
              styles.filterTab,
              isSelected
                ? [styles.filterTabSelected, { backgroundColor: theme.primary, borderColor: theme.primary }]
                : [styles.filterTabUnselected, { backgroundColor: theme.surface, borderColor: theme.border }],
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                isSelected
                  ? [styles.filterTextSelected, { color: theme.onPrimary }]
                  : [styles.filterTextUnselected, { color: theme.text }],
              ]}
            >
              {displayLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  filterTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
  },
  filterTabSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  filterTextSelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  filterTextUnselected: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
});
