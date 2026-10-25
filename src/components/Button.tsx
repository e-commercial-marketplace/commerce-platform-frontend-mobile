/**
 * Reusable button component with variants used across the app.
 * Supports primary, secondary/outline, danger styles with disabled/loading states.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

type ButtonProps = {
  /** Button label text. */
  title: string;
  /** Press handler. */
  onPress: () => void;
  /** Visual variant. */
  variant?: ButtonVariant;
  /** Disables interaction. */
  disabled?: boolean;
  /** Shows loading indicator and disables interaction. */
  loading?: boolean;
  /** Full width button. */
  fullWidth?: boolean;
  /** Accessibility label override. */
  accessibilityLabel?: string;
  /** Additional container style. */
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        (pressed || isDisabled) && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.primary}
            size="small"
          />
          <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
        </View>
      ) : (
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  danger: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  text: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
});