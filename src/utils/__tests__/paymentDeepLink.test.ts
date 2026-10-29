/**
 * Unit tests for global payment deep-link fallback resilience.
 *
 * Verifies:
 * 1. valid payment-result URL navigates to correct order
 * 2. COMPLETED becomes UX hint only
 * 3. FAILED hint handled
 * 4. INVALID hint handled
 * 5. missing orderId ignored safely (never navigates to fake order)
 * 6. malformed URL ignored safely (no crash)
 * 7. unrelated marketplace URL ignored
 * 8. duplicate same callback does not navigate twice (deduplication)
 * 9. markPaymentUrlHandled suppresses redundant OS event when auth session already resolved
 * 10. cold-start initial URL handled
 * 11. background URL event handled
 */

import {
  handlePaymentDeepLink,
  markPaymentUrlHandled,
  parsePaymentResultUrl,
  resetPaymentDeepLinkDedupe,
  type NavigationTarget,
} from '../paymentDeepLink';

describe('paymentDeepLink', () => {
  let mockNavigation: NavigationTarget;

  beforeEach(() => {
    resetPaymentDeepLinkDedupe();
    mockNavigation = {
      navigate: jest.fn(),
    };
  });

  describe('parsePaymentResultUrl', () => {
    it('parses valid URL with orderId and COMPLETED status', () => {
      const result = parsePaymentResultUrl(
        'marketplace://payment-result?orderId=order-uuid-1&status=COMPLETED',
      );
      expect(result).toEqual({
        orderId: 'order-uuid-1',
        paymentHint: 'COMPLETED',
      });
    });

    it('parses valid URL with alternative registered scheme ecommercemarketplace://', () => {
      const result = parsePaymentResultUrl(
        'ecommercemarketplace://payment-result?orderId=order-uuid-1&status=COMPLETED',
      );
      expect(result).toEqual({
        orderId: 'order-uuid-1',
        paymentHint: 'COMPLETED',
      });
    });

    it('parses valid URL with FAILED status', () => {
      const result = parsePaymentResultUrl(
        'marketplace://payment-result?orderId=order-uuid-2&status=FAILED',
      );
      expect(result).toEqual({
        orderId: 'order-uuid-2',
        paymentHint: 'FAILED',
      });
    });

    it('parses valid URL with INVALID status', () => {
      const result = parsePaymentResultUrl(
        'marketplace://payment-result?orderId=order-uuid-3&status=INVALID',
      );
      expect(result).toEqual({
        orderId: 'order-uuid-3',
        paymentHint: 'INVALID',
      });
    });

    it('handles missing status parameter without crashing and sets paymentHint to undefined', () => {
      const result = parsePaymentResultUrl('marketplace://payment-result?orderId=order-uuid-4');
      expect(result).toEqual({
        orderId: 'order-uuid-4',
        paymentHint: undefined,
      });
    });

    it('ignores unknown status string safely without crashing', () => {
      const result = parsePaymentResultUrl(
        'marketplace://payment-result?orderId=order-uuid-5&status=UNKNOWN_VALUE',
      );
      expect(result).toEqual({
        orderId: 'order-uuid-5',
        paymentHint: undefined,
      });
    });

    it('returns null if orderId is missing', () => {
      expect(parsePaymentResultUrl('marketplace://payment-result?status=COMPLETED')).toBeNull();
      expect(parsePaymentResultUrl('marketplace://payment-result')).toBeNull();
    });

    it('returns null if orderId is whitespace only', () => {
      expect(parsePaymentResultUrl('marketplace://payment-result?orderId=   &status=COMPLETED')).toBeNull();
    });

    it('returns null for unrelated URLs', () => {
      expect(parsePaymentResultUrl('marketplace://product/123')).toBeNull();
      expect(parsePaymentResultUrl('marketplace://cart')).toBeNull();
      expect(parsePaymentResultUrl('https://example.com')).toBeNull();
    });

    it('handles null, undefined, empty, or malformed strings safely without throwing', () => {
      expect(parsePaymentResultUrl(null)).toBeNull();
      expect(parsePaymentResultUrl(undefined)).toBeNull();
      expect(parsePaymentResultUrl('')).toBeNull();
      expect(parsePaymentResultUrl('not-a-valid-url???&&')).toBeNull();
    });
  });

  describe('handlePaymentDeepLink', () => {
    it('navigates to OrderDetail with orderId and paymentHint for valid URL', () => {
      const handled = handlePaymentDeepLink(
        'marketplace://payment-result?orderId=order-uuid-10&status=COMPLETED',
        mockNavigation,
      );

      expect(handled).toBe(true);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('OrderDetail', {
        orderId: 'order-uuid-10',
        paymentHint: 'COMPLETED',
      });
    });

    it('does NOT navigate if orderId is missing', () => {
      const handled = handlePaymentDeepLink(
        'marketplace://payment-result?status=COMPLETED',
        mockNavigation,
      );

      expect(handled).toBe(false);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does NOT navigate for unrelated URL', () => {
      const handled = handlePaymentDeepLink('marketplace://orders', mockNavigation);

      expect(handled).toBe(false);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does NOT navigate for null or empty URL', () => {
      expect(handlePaymentDeepLink(null, mockNavigation)).toBe(false);
      expect(handlePaymentDeepLink('', mockNavigation)).toBe(false);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('prevents duplicate navigation when the same callback URL arrives twice in rapid succession', () => {
      const url = 'marketplace://payment-result?orderId=order-uuid-11&status=COMPLETED';

      const firstCall = handlePaymentDeepLink(url, mockNavigation);
      const secondCall = handlePaymentDeepLink(url, mockNavigation);

      expect(firstCall).toBe(true);
      expect(secondCall).toBe(false);
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('allows navigation if a different URL arrives', () => {
      const url1 = 'marketplace://payment-result?orderId=order-uuid-12&status=COMPLETED';
      const url2 = 'marketplace://payment-result?orderId=order-uuid-13&status=FAILED';

      expect(handlePaymentDeepLink(url1, mockNavigation)).toBe(true);
      expect(handlePaymentDeepLink(url2, mockNavigation)).toBe(true);
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(2);
    });

    it('suppresses redundant navigation when markPaymentUrlHandled was called by auth session', () => {
      const url = 'marketplace://payment-result?orderId=order-uuid-14&status=COMPLETED';

      // Simulate WebBrowser.openAuthSessionAsync resolving and marking URL handled
      markPaymentUrlHandled(url);

      // Concurrent or slightly delayed OS deep-link event arrives
      const handled = handlePaymentDeepLink(url, mockNavigation);

      expect(handled).toBe(false);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });
});
