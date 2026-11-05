/**
 * Controlled search input with icon and clear action.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 * Localized search placeholder and clear action.
 */

import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';

type SearchBarProps = {
  /** Current query value (controlled). */
  value: string;
  /** Called on every keystroke and when the clear button is pressed. */
  onChangeText: (text: string) => void;
  /** Optional placeholder override. */
  placeholder?: string;
  testID?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  testID,
}: SearchBarProps) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const defaultPlaceholder = t('common.search', 'Search for product');
  const effectivePlaceholder = placeholder ?? defaultPlaceholder;

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.icon, { color: theme.textSecondary }]}>⌕</Text>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={effectivePlaceholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={effectivePlaceholder}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={spacing.sm}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.clear', 'Clear search')}
        >
          <Text style={[styles.clearIcon, { color: theme.textSecondary }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  icon: {
    fontSize: 15,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
});
