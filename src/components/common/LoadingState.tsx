/**
 * Reusable Centered Loading State.
 *
 * Implements:
 * 1. Centered activity spinner with theme primary tint
 * 2. Localized loading message
 * 3. Configurable size and custom message
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../../constants/theme';
import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';

export interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'large';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({
  message,
  size = 'large',
  testID = 'loading-state',
  style,
}: LoadingStateProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const displayMessage = message ?? t('common.loading', 'Đang tải...');

  return (
    <View testID={testID} style={[styles.container, style]}>
      <ActivityIndicator size={size} color={theme.primary} />
      {displayMessage ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {displayMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LoadingState;
