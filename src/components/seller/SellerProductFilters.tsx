/**
 * Seller Product Filters component.
 *
 * Purely controlled filtering toolbar for seller products:
 * - Search input: accepts controlled searchQuery and calls onSearchChange
 * - Status filter tabs:
 *   - ALL: status is `undefined`
 *   - LISTED: status is `true`
 *   - UNLISTED: status is `false` (explicit boolean preserved)
 *
 * NOTE: Search debouncing is delegated to the hosting screen level.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';

export type StatusOption = {
  label: string;
  value: boolean | undefined;
  accessibilityLabel: string;
};

export const STATUS_OPTIONS: StatusOption[] = [
  { label: 'All', value: undefined, accessibilityLabel: 'Filter by all products' },
  { label: 'Listed', value: true, accessibilityLabel: 'Filter by listed products' },
  { label: 'Unlisted', value: false, accessibilityLabel: 'Filter by unlisted products' },
];

export type SellerProductFiltersProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus?: boolean;
  onStatusChange: (status: boolean | undefined) => void;
  disabled?: boolean;
};

export default function SellerProductFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  disabled = false,
}: SellerProductFiltersProps) {
  return (
    <View style={styles.container}>
      <View style={styles.searchWrapper}>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search my products..."
          placeholderTextColor={colors.textSecondary}
          editable={!disabled}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search my products"
          accessibilityRole="search"
          style={[styles.searchInput, disabled && styles.disabledInput]}
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => onSearchChange('')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Clear search text"
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabsRow}>
        {STATUS_OPTIONS.map((option) => {
          // Explicit comparison handles boolean false vs undefined properly
          const isSelected = selectedStatus === option.value;
          return (
            <Pressable
              key={option.label}
              onPress={() => onStatusChange(option.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={option.accessibilityLabel}
              accessibilityState={{ selected: isSelected, disabled }}
              style={({ pressed }) => [
                styles.tab,
                isSelected ? styles.tabSelected : styles.tabUnselected,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  isSelected ? styles.tabTextSelected : styles.tabTextUnselected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    minHeight: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingRight: 40,
    color: colors.text,
    fontSize: 14,
  },
  disabledInput: {
    opacity: 0.6,
  },
  clearButton: {
    position: 'absolute',
    right: spacing.sm,
    height: 32,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tabSelected: {
    backgroundColor: colors.primary,
  },
  tabUnselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextSelected: {
    color: colors.onPrimary,
  },
  tabTextUnselected: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
