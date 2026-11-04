/**
 * Theme & Design Token Types.
 *
 * Provides typed definitions for:
 * - Theme preferences ('light' | 'dark')
 * - Resolved theme appearance ('light' | 'dark')
 * - Semantic color palette tokens
 * - Full app theme tokens (colors, spacing, radii, typography)
 */

import type { radii, spacing, typography } from '../constants/theme';

export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface SemanticColors {
  background: string;
  surface: string;
  surfaceSubdued: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  border: string;
  borderStrong: string;

  primary: string;
  primaryPressed: string;

  danger: string;
  dangerSurface: string;
  dangerText: string;

  success: string;
  successSurface: string;
  successText: string;

  warning: string;
  warningSurface: string;
  warningText: string;

  overlay: string;
  [key: string]: string;
}

export interface AppThemeTokens {
  colors: SemanticColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

export interface AppThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  theme: SemanticColors;
  tokens: AppThemeTokens;
}
