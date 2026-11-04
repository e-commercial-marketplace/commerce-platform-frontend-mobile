/**
 * Reusable Error State Display with Retry Action.
 *
 * Implements:
 * 1. Warning icon and error message display
 * 2. Optional or default Retry button
 * 3. Localized default copy
 * 4. Theme-aware semantic colors
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../../constants/theme';
import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';
import Button from '../Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryTitle?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryTitle,
  testID = 'error-state',
  style,
}: ErrorStateProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const displayTitle = title ?? t('common.error', 'Đã có lỗi xảy ra');
  const displayRetryTitle = retryTitle ?? t('common.retry', 'Thử lại');

  return (
    <View testID={testID} style={[styles.container, style]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, { color: theme.dangerText }]}>{displayTitle}</Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      {onRetry ? (
        <View style={styles.actionContainer}>
          <Button
            title={displayRetryTitle}
            onPress={onRetry}
            variant="outline"
            accessibilityLabel={displayRetryTitle}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 42,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  actionContainer: {
    marginTop: spacing.lg,
    minWidth: 140,
  },
});

export default ErrorState;
