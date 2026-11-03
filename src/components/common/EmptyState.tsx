/**
 * Reusable Empty State Display.
 *
 * Implements:
 * 1. Centered layout with visual icon/illustration
 * 2. Localized title and description defaults
 * 3. Optional action button (e.g. "Browse products" or "Reset filters")
 * 4. Theme-aware colors
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../../constants/theme';
import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';
import Button from '../Button';

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: string;
  actionTitle?: string;
  onAction?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  message,
  icon = '📦',
  actionTitle,
  onAction,
  testID = 'empty-state',
  style,
}: EmptyStateProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const displayTitle = title ?? t('common.empty', 'Không có dữ liệu');
  const displayMessage = message ?? t('common.noDataDescription', 'Không tìm thấy kết quả nào phù hợp.');

  return (
    <View testID={testID} style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.title, { color: theme.text }]}>{displayTitle}</Text>
      {displayMessage ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {displayMessage}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <View style={styles.actionContainer}>
          <Button title={actionTitle} onPress={onAction} variant="primary" />
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
    fontSize: 48,
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
    maxWidth: 280,
  },
  actionContainer: {
    marginTop: spacing.lg,
    minWidth: 160,
  },
});

export default EmptyState;
