/**
 * Small pure formatting helpers shared across screens.
 */

/**
 * Formats an integer VND amount using dot grouping, e.g. 12990000 →
 * "12.990.000 ₫". Implemented manually instead of Intl for consistent
 * behavior across Hermes runtimes.
 */
export function formatVND(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped} ₫`;
}
