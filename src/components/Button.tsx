/**
 * Reusable button component with variants used across the app.
 * Supports primary, secondary, outline, danger styles with disabled/loading states.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppTheme } from '../theme';

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
  /** Optional testID. */
  testID?: string;
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
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const { theme } = useAppTheme();

  const variantStyles = useMemo(() => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: theme.primary,
            borderWidth: 0,
          },
          textColor: '#FFFFFF',
          indicatorColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
          },
          textColor: theme.text,
          indicatorColor: theme.primary,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.primary,
          },
          textColor: theme.primary,
          indicatorColor: theme.primary,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: theme.dangerSurface,
            borderWidth: 1,
            borderColor: theme.danger,
          },
          textColor: theme.dangerText,
          indicatorColor: theme.danger,
        };
    }
  }, [variant, theme]);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles.container,
        fullWidth && styles.fullWidth,
        (pressed || isDisabled) && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={variantStyles.indicatorColor} size="small" />
          <Text style={[styles.text, styles.label, { color: variantStyles.textColor }]}>
            {title}
          </Text>
        </View>
      ) : (
        <Text style={[styles.text, styles.label, { color: variantStyles.textColor }]}>
          {title}
        </Text>
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
  label: {
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
