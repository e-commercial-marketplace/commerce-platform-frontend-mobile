/**
 * Reusable Header Bar for Screens & Sub-views.
 *
 * Implements:
 * 1. Back button with localized accessibility label
 * 2. Title and optional subtitle
 * 3. Right action slot
 * 4. Theme-aware semantic surface & border
 */

import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../../constants/theme';
import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function HeaderBar({
  title,
  subtitle,
  onBack,
  rightAction,
  testID = 'header-bar',
  style,
}: HeaderBarProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const backLabel = t('common.back', 'Quay lại');

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
        },
        style,
      ]}
    >
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            testID="header-back-btn"
            style={styles.backButton}
          >
            <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  backIcon: {
    fontSize: 22,
    fontWeight: '600',
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
});

export default HeaderBar;
