/**
 * Reusable Status / Label Badge.
 *
 * Implements:
 * 1. Variants: primary, success, danger, warning, subdued, outline
 * 2. Semantic tokens from useAppTheme()
 * 3. Tamagui XStack layout primitive
 * 4. Accessible text-role labeling
 */

import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { XStack } from 'tamagui';

import { useAppTheme } from '../../theme';

export type BadgeVariant = 'primary' | 'success' | 'danger' | 'warning' | 'subdued' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Badge({
  label,
  variant = 'subdued',
  size = 'md',
  icon,
  testID,
  style,
}: BadgeProps) {
  const { theme } = useAppTheme();

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: theme.primary,
          border: theme.primary,
          text: '#FFFFFF',
        };
      case 'success':
        return {
          bg: theme.successSurface,
          border: theme.successSurface,
          text: theme.successText,
        };
      case 'danger':
        return {
          bg: theme.dangerSurface,
          border: theme.dangerSurface,
          text: theme.dangerText,
        };
      case 'warning':
        return {
          bg: theme.warningSurface,
          border: theme.warningSurface,
          text: theme.warningText,
        };
      case 'outline':
        return {
          bg: 'transparent',
          border: theme.border,
          text: theme.textSecondary,
        };
      case 'subdued':
      default:
        return {
          bg: theme.surfaceSubdued,
          border: theme.surfaceSubdued,
          text: theme.textSecondary,
        };
    }
  };

  const colors = getVariantColors();
  const isSm = size === 'sm';

  return (
    <XStack
      testID={testID}
      accessibilityRole="text"
      alignItems="center"
      justifyContent="center"
      backgroundColor={colors.bg}
      borderColor={colors.border}
      borderWidth={variant === 'outline' ? 1 : 0}
      borderRadius={isSm ? 8 : 12}
      paddingHorizontal={isSm ? 6 : 10}
      paddingVertical={isSm ? 2 : 4}
      style={style}
    >
      {icon ? (
        <Text
          style={[
            styles.icon,
            { color: colors.text, fontSize: isSm ? 10 : 12, marginRight: 4 },
          ]}
        >
          {icon}
        </Text>
      ) : null}
      <Text
        style={[
          styles.label,
          {
            color: colors.text,
            fontSize: isSm ? 11 : 12,
            fontWeight: variant === 'primary' ? '700' : '600',
          },
        ]}
      >
        {label}
      </Text>
    </XStack>
  );
}

const styles = StyleSheet.create({
  icon: {},
  label: {
    letterSpacing: 0.1,
  },
});

export default Badge;
