/**
 * Semantic Design Tokens for UI Personalization.
 *
 * Defines:
 * - lightColors: Standard bright theme matching current brand identity (#08B8CC)
 * - darkColors: Intentionally designed dark OLED palette with accessible contrast
 * - Normalized spacing, radii, and typography scales from constants/theme
 */

import { radii, spacing, typography } from '../constants/theme';
import type { AppThemeTokens, SemanticColors } from './types';

export const lightColors: SemanticColors = {
  background: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceSubdued: '#F2F4F7',

  text: '#242731',
  textSecondary: '#667085',
  textMuted: '#8B93A5',

  border: '#E8EAF0',
  borderStrong: '#D0D5DD',

  primary: '#08B8CC',
  primaryPressed: '#0696A7',

  danger: '#E95656',
  dangerSurface: '#FEF3F2',
  dangerText: '#B42318',

  success: '#027A48',
  successSurface: '#ECFDF3',
  successText: '#027A48',

  warning: '#B54708',
  warningSurface: '#FEF0C7',
  warningText: '#B54708',

  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const darkColors: SemanticColors = {
  background: '#121212',
  surface: '#1E232E',
  surfaceSubdued: '#262B36',

  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  border: '#2E3545',
  borderStrong: '#475467',

  primary: '#08B8CC',
  primaryPressed: '#0EABC2',

  danger: '#F87171',
  dangerSurface: '#450A0A',
  dangerText: '#FCA5A5',

  success: '#34D399',
  successSurface: '#064E3B',
  successText: '#6EE7B7',

  warning: '#FBBF24',
  warningSurface: '#451A03',
  warningText: '#FDE68A',

  overlay: 'rgba(0, 0, 0, 0.75)',
};

export const lightTokens: AppThemeTokens = {
  colors: lightColors,
  spacing,
  radii,
  typography,
};

export const darkTokens: AppThemeTokens = {
  colors: darkColors,
  spacing,
  radii,
  typography,
};

export { radii, spacing, typography };
