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

/**
 * Formats a chat timestamp in a Vietnamese-friendly, stable format without heavy libraries:
 * - Today: 'HH:mm' (e.g. '14:30')
 * - Yesterday: 'Hôm qua'
 * - Within current year: 'DD/MM' (e.g. '24/10')
 * - Earlier years: 'DD/MM/YYYY' (e.g. '15/08/2025')
 */
export function formatChatTimestamp(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (isToday) {
      return `${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Hôm qua';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    if (date.getFullYear() === now.getFullYear()) {
      return `${day}/${month}`;
    }

    return `${day}/${month}/${date.getFullYear()}`;
  } catch {
    return '';
  }
}
