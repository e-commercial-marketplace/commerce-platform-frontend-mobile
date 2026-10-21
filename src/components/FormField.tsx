/**
 * Labeled text input with inline validation message and a built-in
 * show/hide toggle for password fields (text-only, no icon dependency).
 * Presentation-only: the parent screen owns the value, the validation logic
 * and the error text, which keeps it reusable across Login and Register.
 * Styling follows the existing SearchBar input shell (surface + border).
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';

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
}: FormFieldProps) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputShell,
          !editable && styles.inputShellLocked,
          error != null && styles.inputShellError,
        ]}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={hidden}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((previous) => !previous)}
            hitSlop={spacing.sm}
            style={styles.toggleButton}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}
      </View>
      {error != null && <Text style={styles.errorText}>{error}</Text>}
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
    color: colors.text,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputShellLocked: {
    opacity: 0.6,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
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
    color: colors.primary,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
  },
});
