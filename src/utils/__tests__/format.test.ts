/**
 * Unit tests for formatVND and formatChatTimestamp.
 */

import { formatChatTimestamp, formatVND } from '../format';

describe('formatVND', () => {
  it('groups thousands with dots and appends the currency symbol', () => {
    expect(formatVND(29990000)).toBe('29.990.000 ₫');
    expect(formatVND(29900000)).toBe('29.900.000 ₫');
  });

  it('formats amounts below 1000 without separators', () => {
    expect(formatVND(500)).toBe('500 ₫');
  });

  it('formats exactly one thousand', () => {
    expect(formatVND(1000)).toBe('1.000 ₫');
  });

  it('handles zero', () => {
    expect(formatVND(0)).toBe('0 ₫');
  });

  it('rounds fractional amounts to the nearest integer', () => {
    expect(formatVND(1500.4)).toBe('1.500 ₫');
    expect(formatVND(1500.6)).toBe('1.501 ₫');
  });

  it('places the sign before the grouped digits for negative amounts', () => {
    expect(formatVND(-1250000)).toBe('-1.250.000 ₫');
  });
});

describe('formatChatTimestamp', () => {
  it('returns empty string for null, undefined, or empty strings', () => {
    expect(formatChatTimestamp(null)).toBe('');
    expect(formatChatTimestamp(undefined)).toBe('');
    expect(formatChatTimestamp('')).toBe('');
    expect(formatChatTimestamp('not a date')).toBe('');
  });

  it('formats today timestamp as HH:mm', () => {
    const today = new Date();
    today.setHours(14, 30, 0, 0);
    expect(formatChatTimestamp(today.toISOString())).toBe('14:30');
  });

  it('formats yesterday timestamp as "Yesterday"', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(9, 15, 0, 0);
    expect(formatChatTimestamp(yesterday.toISOString())).toBe('Yesterday');
  });

  it('formats older dates in current year as DD/MM', () => {
    const now = new Date();
    const olderThisYear = new Date(now.getFullYear(), 0, 15, 10, 0, 0);
    // If today is Jan 15 or 16, skip asserting exact or choose a safe day
    if (now.getMonth() !== 0 || now.getDate() > 2) {
      expect(formatChatTimestamp(olderThisYear.toISOString())).toBe('15/01');
    }
  });

  it('formats previous year dates as DD/MM/YYYY', () => {
    const prevYear = new Date(2023, 4, 20, 12, 0, 0);
    expect(formatChatTimestamp(prevYear.toISOString())).toBe('20/05/2023');
  });
});
