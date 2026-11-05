/**
 * LanguageSelector — Compact Segmented Language Picker (🇻🇳 VI | 🇬🇧 EN).
 *
 * Implements:
 * 1. Compact segmented selector for Vietnamese and English
 * 2. Instant runtime switching via useAppLanguage() without app restart
 * 3. Immediate persistence to local storage
 * 4. Theme-aware colors derived from useAppTheme()
 * 5. Uses Tamagui XStack layout primitive
 * 6. Accessible touch targets and accessibility states
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { XStack } from 'tamagui';

import { useAppLanguage } from '../../i18n';
import type { SupportedLanguage } from '../../i18n/types';
import { useAppTheme } from '../../theme';

interface LanguageOption {
  code: SupportedLanguage;
  badge: string;
  name: string;
  testID: string;
}

const OPTIONS: LanguageOption[] = [
  { code: 'vi', badge: '🇻🇳 VI', name: 'Tiếng Việt', testID: 'language-btn-vi' },
  { code: 'en', badge: '🇬🇧 EN', name: 'English', testID: 'language-btn-en' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useAppLanguage();
  const { theme, tokens } = useAppTheme();

  return (
    <XStack
      testID="language-selector"
      accessibilityRole="radiogroup"
      accessibilityLabel="Chọn ngôn ngữ / Select language"
      flexDirection="row"
      alignItems="center"
      padding={3}
      borderRadius={20}
      borderWidth={1}
      backgroundColor={theme.surfaceSubdued}
      borderColor={theme.border}
    >
      {OPTIONS.map((option) => {
        const isSelected = language === option.code;
        return (
          <Pressable
            key={option.code}
            onPress={() => setLanguage(option.code)}
            accessibilityRole="radio"
            accessibilityLabel={option.name}
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
            <Text
              style={[
                styles.badgeText,
                {
                  color: isSelected ? theme.primary : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
            >
              {option.badge}
            </Text>
          </Pressable>
        );
      })}
    </XStack>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  badgeText: {
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});

export default LanguageSelector;
