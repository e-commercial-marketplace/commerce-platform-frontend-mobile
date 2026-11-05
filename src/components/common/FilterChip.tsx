/**
 * Reusable Filter / Option Chip.
 *
 * Implements:
 * 1. Selected and unselected states with semantic theme tokens
 * 2. Integrated tactile press micro-interaction via AnimatedPressable
 * 3. Tamagui XStack layout primitive
 * 4. Accessible selection state
 */

import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { XStack } from 'tamagui';

import { AnimatedPressable } from '../../animation';
import { useAppTheme } from '../../theme';

export interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  icon?: string;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function FilterChip({
  label,
  selected,
  onPress,
  count,
  icon,
  disabled = false,
  testID,
  style,
}: FilterChipProps) {
  const { theme } = useAppTheme();

  const bg = selected ? theme.primary : theme.surfaceSubdued;
  const borderColor = selected ? theme.primary : theme.border;
  const textColor = selected ? '#FFFFFF' : theme.textSecondary;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}${count !== undefined ? ` (${count})` : ''}`}
      style={style}
    >
      <XStack
        alignItems="center"
        justifyContent="center"
        backgroundColor={bg}
        borderColor={borderColor}
        borderWidth={1}
        borderRadius={18}
        paddingHorizontal={12}
        paddingVertical={6}
        opacity={disabled ? 0.5 : 1}
      >
        {icon ? (
          <Text style={[styles.icon, { color: textColor, marginRight: 4 }]}>
            {icon}
          </Text>
        ) : null}
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontWeight: selected ? '700' : '500',
            },
          ]}
        >
          {label}
        </Text>
        {count !== undefined ? (
          <Text
            style={[
              styles.count,
              {
                color: selected ? '#FFFFFF' : theme.textMuted,
                marginLeft: 4,
              },
            ]}
          >
            ({count})
          </Text>
        ) : null}
      </XStack>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 13,
  },
  count: {
    fontSize: 12,
  },
});

export default FilterChip;
