/**
 * UI Personalization & Settings Screen.
 *
 * Implements:
 * 1. Appearance / Theme selection (Light, Dark)
 * 2. Language selection (🇻🇳 VI | 🇬🇧 EN) with immediate switching
 * 3. Grouped settings cards with Tamagui YStack and Card building blocks
 * 4. Application version and info
 * 5. Full Dark/Light theme adaptability
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { Card, LanguageSelector, ThemeSelector } from '../components/common';
import { radii, spacing } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';

export default function SettingsScreen({
  navigation,
}: AppNavigatorScreenProps<'Settings'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="settings-screen"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <YStack gap="$4">
          {/* Appearance Section */}
          <Card variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIcon}>🎨</Text>
              <View style={styles.sectionTitles}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t('settings.theme.title', 'Giao diện')}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {t('settings.theme.subtitle', 'Tùy chỉnh chế độ sáng hoặc tối')}
                </Text>
              </View>
            </View>
            <View style={styles.controlRow}>
              <ThemeSelector />
            </View>
          </Card>

          {/* Language Section */}
          <Card variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIcon}>🌐</Text>
              <View style={styles.sectionTitles}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t('settings.language.title', 'Ngôn ngữ')}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {t('settings.language.select', 'Chọn ngôn ngữ giao diện ứng dụng')}
                </Text>
              </View>
            </View>
            <View style={styles.controlRow}>
              <LanguageSelector />
            </View>
          </Card>

          {/* About Section */}
          <Card variant="outlined" style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionIcon}>📱</Text>
              <View style={styles.sectionTitles}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {t('settings.about.title', 'Thông tin ứng dụng')}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {t('settings.about.appName', 'Sàn Thương Mại Điện Tử')}
                </Text>
              </View>
            </View>
            <View style={[styles.versionRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.versionLabel, { color: theme.textSecondary }]}>
                {t('settings.about.versionLabel', 'Phiên bản')}
              </Text>
              <Text style={[styles.versionValue, { color: theme.text }]}>
                {t('settings.about.versionValue', '1.0.0 (Personalization Phase 3)')}
              </Text>
            </View>
          </Card>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    fontSize: 26,
  },
  sectionTitles: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  controlRow: {
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  versionLabel: {
    fontSize: 14,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
