/**
 * Unit tests for formatVND — pure dot-grouping VND formatter.
 */

import { formatVND } from '../format';

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
