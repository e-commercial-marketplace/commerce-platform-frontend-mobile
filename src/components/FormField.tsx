/**
 * Labeled text input with inline validation message and a built-in
 * show/hide toggle for password fields.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 * Localized Show/Hide toggle.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';

type FormFieldProps = {
  /** Label rendered above the input. */
  label: string;
  /** Current value (controlled). */
  value: string;
  /** Called on every keystroke. */
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Validation message shown under the input; also tints the border. */
  error?: string;
  /** Masks the text and shows the Show/Hide toggle when true. */
  secureTextEntry?: boolean;
  /** Set false to lock the field while a request is in flight. */
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  testID?: string;
};

export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  returnKeyType,
  onSubmitEditing,
  testID,
}: FormFieldProps) {
  const [hidden, setHidden] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const showLabel = t('common.show', 'Show');
  const hideLabel = t('common.hide', 'Hide');

  return (
    <View style={styles.field} testID={testID}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: theme.surface,
            borderColor: error != null ? theme.danger : isFocused ? theme.primary : theme.border,
          },
          !editable && styles.inputShellLocked,
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={hidden}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          accessibilityLabel={label}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((previous) => !previous)}
            hitSlop={spacing.sm}
            style={styles.toggleButton}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `${showLabel} password` : `${hideLabel} password`}
          >
            <Text style={[styles.toggleText, { color: theme.primary }]}>
              {hidden ? showLabel : hideLabel}
            </Text>
          </Pressable>
        )}
      </View>
      {error != null && (
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputShellLocked: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.sm,
  },
  toggleButton: {
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
  },
});
