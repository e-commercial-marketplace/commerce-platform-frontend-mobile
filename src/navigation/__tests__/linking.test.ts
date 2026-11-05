/**
 * Unit tests for React Navigation linking configuration for VNPay deep links.
 *
 * Verifies:
 * 1. Prefixes contain marketplace:// and ecommercemarketplace://
 * 2. getInitialURL handles cold start and deduplicates already handled URLs
 * 3. subscribe forwards background URL events to listener and suppresses duplicate auth session URLs
 * 4. getStateFromPath parses orderId and paymentHint for OrderDetail route
 * 5. getStateFromPath returns undefined for missing orderId or unrelated paths
 */

import * as Linking from 'expo-linking';

import {
  isPaymentUrlHandled,
  markPaymentUrlHandled,
  resetPaymentDeepLinkDedupe,
} from '../../utils/paymentDeepLink';
import { linking } from '../linking';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

const mockedGetInitialURL = Linking.getInitialURL as jest.MockedFunction<typeof Linking.getInitialURL>;
const mockedAddEventListener = Linking.addEventListener as jest.MockedFunction<
  typeof Linking.addEventListener
>;

describe('linking configuration', () => {
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetPaymentDeepLinkDedupe();
    mockedGetInitialURL.mockResolvedValue(null);
    mockedAddEventListener.mockReturnValue({ remove: mockRemove } as any);
  });

  describe('prefixes', () => {
    it('registers marketplace:// and ecommercemarketplace:// schemes', () => {
      expect(linking.prefixes).toContain('marketplace://');
      expect(linking.prefixes).toContain('ecommercemarketplace://');
    });
  });

  describe('getInitialURL (cold start)', () => {
    it('returns the URL when Linking.getInitialURL resolves to a new URL', async () => {
      mockedGetInitialURL.mockResolvedValue(
        'marketplace://payment-result?orderId=order-cold-1&status=COMPLETED',
      );

      const url = await linking.getInitialURL!();

      expect(url).toBe('marketplace://payment-result?orderId=order-cold-1&status=COMPLETED');
    });

    it('returns null when Linking.getInitialURL resolves to null', async () => {
      mockedGetInitialURL.mockResolvedValue(null);

      const url = await linking.getInitialURL!();

      expect(url).toBeNull();
    });

    it('returns null when the URL was already handled (deduplication)', async () => {
      const targetUrl = 'marketplace://payment-result?orderId=order-cold-2&status=COMPLETED';
      markPaymentUrlHandled(targetUrl);
      mockedGetInitialURL.mockResolvedValue(targetUrl);

      const url = await linking.getInitialURL!();

      expect(url).toBeNull();
    });
  });

  describe('subscribe (background / resume)', () => {
    it('subscribes to Linking url events and returns unsubscribe function', () => {
      const listener = jest.fn();

      const unsubscribe = linking.subscribe!(listener);

      expect(mockedAddEventListener).toHaveBeenCalledWith('url', expect.any(Function));
      expect(typeof unsubscribe).toBe('function');

      unsubscribe!();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('forwards URL to listener when unhandled URL event arrives', () => {
      let registeredHandler!: ({ url }: { url: string }) => void;
      mockedAddEventListener.mockImplementation((_type, handler) => {
        registeredHandler = handler;
        return { remove: mockRemove } as any;
      });

      const listener = jest.fn();
      linking.subscribe!(listener);

      registeredHandler({ url: 'marketplace://payment-result?orderId=order-bg-1&status=COMPLETED' });

      expect(listener).toHaveBeenCalledWith(
        'marketplace://payment-result?orderId=order-bg-1&status=COMPLETED',
      );
    });

    it('suppresses duplicate URL event when markPaymentUrlHandled was already called by auth session', () => {
      let registeredHandler!: ({ url }: { url: string }) => void;
      mockedAddEventListener.mockImplementation((_type, handler) => {
        registeredHandler = handler;
        return { remove: mockRemove } as any;
      });

      const listener = jest.fn();
      linking.subscribe!(listener);

      const targetUrl = 'marketplace://payment-result?orderId=order-bg-2&status=COMPLETED';
      markPaymentUrlHandled(targetUrl);

      registeredHandler({ url: targetUrl });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getStateFromPath', () => {
    it('maps valid payment-result URL with orderId and COMPLETED status to OrderDetail route', () => {
      const state = linking.getStateFromPath!(
        'marketplace://payment-result?orderId=order-route-1&status=COMPLETED',
      ) as any;

      expect(state).toEqual({
        routes: [
          {
            name: 'OrderDetail',
            params: {
              orderId: 'order-route-1',
              paymentHint: 'COMPLETED',
            },
          },
        ],
      });
      expect(isPaymentUrlHandled('marketplace://payment-result?orderId=order-route-1&status=COMPLETED')).toBe(
        true,
      );
    });

    it('maps valid payment-result URL with FAILED status to OrderDetail route', () => {
      const state = linking.getStateFromPath!(
        'marketplace://payment-result?orderId=order-route-2&status=FAILED',
      ) as any;

      expect(state).toEqual({
        routes: [
          {
            name: 'OrderDetail',
            params: {
              orderId: 'order-route-2',
              paymentHint: 'FAILED',
            },
          },
        ],
      });
    });

    it('maps valid payment-result URL with INVALID status to OrderDetail route', () => {
      const state = linking.getStateFromPath!(
        'marketplace://payment-result?orderId=order-route-3&status=INVALID',
      ) as any;

      expect(state).toEqual({
        routes: [
          {
            name: 'OrderDetail',
            params: {
              orderId: 'order-route-3',
              paymentHint: 'INVALID',
            },
          },
        ],
      });
    });

    it('handles missing status query param by setting paymentHint to undefined', () => {
      const state = linking.getStateFromPath!(
        'marketplace://payment-result?orderId=order-route-4',
      ) as any;

      expect(state).toEqual({
        routes: [
          {
            name: 'OrderDetail',
            params: {
              orderId: 'order-route-4',
              paymentHint: undefined,
            },
          },
        ],
      });
    });

    it('returns undefined if orderId is missing (never navigates to fake order)', () => {
      const state = linking.getStateFromPath!(
        'marketplace://payment-result?status=COMPLETED',
      );

      expect(state).toBeUndefined();
    });

    it('returns undefined for unrelated path (e.g. products/123)', () => {
      const state = linking.getStateFromPath!('marketplace://products/123');

      expect(state).toBeUndefined();
    });
  });
});
