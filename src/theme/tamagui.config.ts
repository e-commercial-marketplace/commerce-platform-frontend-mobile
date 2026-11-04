/**
 * Real Tamagui Configuration for Mobile UI.
 *
 * Configures Tamagui tokens, light/dark themes, and shorthand properties.
 * Directly integrates with @tamagui/core and React Native runtime.
 */

import { createTamagui, createTokens } from '@tamagui/core';

import { darkColors, lightColors, radii, spacing } from './tokens';

const tokens = createTokens({
  color: {
    ...lightColors,
    ...darkColors,
    white: '#FFFFFF',
    black: '#000000',
  },
  space: {
    default: spacing.md,
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    xxl: spacing.xxl,
  },
  size: {
    default: spacing.md,
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    xxl: spacing.xxl,
  },
  radius: {
    default: radii.md,
    sm: radii.sm,
    md: radii.md,
    lg: radii.lg,
    xl: radii.xl,
    pill: radii.pill,
  },
  zIndex: {
    modal: 1000,
    overlay: 900,
    dropdown: 800,
  },
});

export const tamaguiConfig = createTamagui({
  defaultTheme: 'light',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  tokens,
  themes: {
    light: lightColors,
    dark: darkColors,
  },
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
