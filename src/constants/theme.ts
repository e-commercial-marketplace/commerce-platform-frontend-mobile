/**
 * Shared design tokens for the app UI.
 * Values follow the project mockups (white surfaces, cyan primary accent).
 * Extend this file when new shared tokens are needed; avoid hard-coding
 * colors or spacing inside screens and navigators.
 */

export const colors = {
  /** Primary brand accent (buttons, active tab, links). */
  primary: '#00BDD6',
  /** Default screen background. */
  background: '#FFFFFF',
  /** Secondary surface (cards, grouped sections). */
  surface: '#F8F9FA',
  /** Primary text color. */
  text: '#111827',
  /** Secondary/muted text color. */
  textSecondary: '#6B7280',
  /** Borders and dividers. */
  border: '#E5E7EB',
  /** Rating star accent. */
  star: '#F59E0B',
  /** Foreground content on top of primary-colored surfaces. */
  onPrimary: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Corner radii shared by cards, inputs, chips and buttons. */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;
