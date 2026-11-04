/**
 * Reusable Surface Card Container.
 *
 * Implements:
 * 1. Variants: elevated, outlined, subdued
 * 2. Theme-aware surface & border tokens
 * 3. Optional touch interaction via AnimatedPressable
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AnimatedPressable } from '../../animation';
import { radii, spacing } from '../../constants/theme';
import { useAppTheme } from '../../theme';

export type CardVariant = 'elevated' | 'outlined' | 'subdued';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'outlined',
  onPress,
  testID,
  style,
}: CardProps) {
  const { theme, isDark } = useAppTheme();

  const getContainerStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.surface,
          borderColor: isDark ? theme.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
          shadowColor: '#000000',
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        };
      case 'subdued':
        return {
          backgroundColor: theme.surfaceSubdued,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: 1,
        };
    }
  };

  const cardStyle = [styles.base, getContainerStyles(), style];

  if (onPress) {
    return (
      <AnimatedPressable testID={testID} onPress={onPress} style={cardStyle}>
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View testID={testID} style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    padding: spacing.md,
  },
});

export default Card;
