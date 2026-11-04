/**
 * ThemeSelector — 2-State Segmented Theme Picker (Light / Dark).
 *
 * Implements:
 * 1. 2-state selector: 'light' (☀️), 'dark' (🌙)
 * 2. Instant runtime switching via useAppTheme()
 * 3. Local device persistence
 * 4. Localized labels using useAppLanguage() and i18n settings namespace
 * 5. Uses Tamagui XStack layout primitive
 * 6. Accessible touch targets and accessibility states
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { XStack } from 'tamagui';

import { useAppLanguage } from '../../i18n';
import { useAppTheme } from '../../theme';
import type { ThemePreference } from '../../theme/types';

interface ThemeOption {
  code: ThemePreference;
  icon: string;
  labelKey: string;
  defaultLabel: string;
  testID: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    code: 'light',
    icon: '☀️',
    labelKey: 'settings.theme.light',
    defaultLabel: 'Sáng',
    testID: 'theme-btn-light',
  },
  {
    code: 'dark',
    icon: '🌙',
    labelKey: 'settings.theme.dark',
    defaultLabel: 'Tối',
    testID: 'theme-btn-dark',
  },
];

export function ThemeSelector() {
  const { themePreference, setThemePreference, theme } = useAppTheme();
  const { t } = useAppLanguage();

  return (
    <XStack
      testID="theme-selector"
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.theme.mode', 'Chế độ hiển thị')}
      flexDirection="row"
      alignItems="center"
      padding={3}
      borderRadius={20}
      borderWidth={1}
      backgroundColor={theme.surfaceSubdued}
      borderColor={theme.border}
    >
      {THEME_OPTIONS.map((option) => {
        const isSelected = themePreference === option.code;
        const label = t(option.labelKey, option.defaultLabel);

        return (
          <Pressable
            key={option.code}
            onPress={() => setThemePreference(option.code)}
            accessibilityRole="radio"
            accessibilityLabel={`${option.icon} ${label}`}
            accessibilityState={{ selected: isSelected }}
            testID={option.testID}
            style={({ pressed }) => [
              styles.optionButton,
              isSelected && {
                backgroundColor: theme.background,
                borderColor: theme.borderStrong,
                shadowColor: '#000000',
                shadowOpacity: 0.08,
                shadowOffset: { width: 0, height: 1 },
                shadowRadius: 2,
                elevation: 1,
              },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <Text
              style={[
                styles.optionLabel,
                {
                  color: isSelected ? theme.primary : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
  },
  optionIcon: {
    fontSize: 14,
  },
  optionLabel: {
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});

export default ThemeSelector;
