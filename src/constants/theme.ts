/**
 * Shared design tokens for the app UI.
 * Values follow the project mockups (white surfaces, cyan primary accent).
 * Extend this file when new shared tokens are needed; avoid hard-coding
 * colors or spacing inside screens and navigators.
 */

export const colors = {
  /** Primary brand accent (buttons, active tab, links). */
  primary: '#08B8CC',
  /** Default screen background. */
  background: '#FFFFFF',
  /** Secondary surface (cards, grouped sections). */
  surface: '#F6F7F9',
  /** Primary text color. */
  text: '#242731',
  /** Secondary/muted text color. */
  textSecondary: '#8B93A5',
  /** Borders and dividers. */
  border: '#E8EAF0',
  /** Rating star accent. */
  star: '#F6C343',
  /** Foreground content on top of primary-colored surfaces. */
  onPrimary: '#FFFFFF',
  /** Destructive actions (remove from cart, clear cart). */
  danger: '#E95656',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/** Corner radii shared by cards, inputs, chips and buttons. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Typography scale for consistent text sizing across screens. */
export const typography = {
  /** Extra small text (labels, captions). */
  xs: 11,
  /** Small text (secondary info, badges). */
  sm: 12,
  /** Body text size. */
  md: 14,
  /** Default text size (inputs, buttons). */
  base: 15,
  /** Section titles, card titles. */
  lg: 16,
  /** Screen section headings. */
  xl: 18,
  /** Major headings. */
  xxl: 20,
  /** Screen titles. */
  xxxl: 22,
} as const;
