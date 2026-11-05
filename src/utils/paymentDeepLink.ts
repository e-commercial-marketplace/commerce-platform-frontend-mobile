/**
 * Global deep-link resilience helper for VNPay payment redirects.
 *
 * Handles:
 * - Direct OS deep-link callback delivery: `marketplace://payment-result?orderId=<uuid>&status=<status>`
 * - Cold-start initial URLs
 * - Background/resume URL events
 * - Deduplication to prevent duplicate navigation when WebBrowser.openAuthSessionAsync
 *   already processed the return URL.
 *
 * Rule:
 * `orderId` is required to locate the authoritative order.
 * `status` is UX hint only ('COMPLETED' | 'FAILED' | 'INVALID').
 * Never treats `status` as payment proof; OrderDetailScreen fetches authoritative state from backend.
 */

export type AllowedPaymentHint = 'COMPLETED' | 'FAILED' | 'INVALID';

export interface ParsedPaymentResult {
  orderId: string;
  paymentHint?: AllowedPaymentHint;
}

let lastHandledUrl: string | null = null;
let lastHandledTimestamp = 0;
const DEDUPE_WINDOW_MS = 3000;

/**
 * Parses transient parameters from a payment result redirect URL.
 * Returns null if the URL is not a payment-result URL or if orderId is missing.
 */
export function parsePaymentResultUrl(url: string | null | undefined): ParsedPaymentResult | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Only handle payment-result paths
    if (!url.includes('payment-result')) {
      return null;
    }

    const qIndex = url.indexOf('?');
    if (qIndex === -1) {
      return null;
    }

    const queryString = url.slice(qIndex + 1);
    const params = new URLSearchParams(queryString);
    const orderId = params.get('orderId');

    if (!orderId || orderId.trim().length === 0) {
      return null;
    }

    const rawStatus = params.get('status');
    let paymentHint: AllowedPaymentHint | undefined;
    if (rawStatus === 'COMPLETED' || rawStatus === 'FAILED' || rawStatus === 'INVALID') {
      paymentHint = rawStatus;
    }

    return {
      orderId: orderId.trim(),
      paymentHint,
    };
  } catch {
    return null;
  }
}

/**
 * Checks whether a URL has already been handled within the deduplication window.
 */
export function isPaymentUrlHandled(url: string | null | undefined): boolean {
  if (!url) return false;
  const now = Date.now();
  return url === lastHandledUrl && now - lastHandledTimestamp < DEDUPE_WINDOW_MS;
}

/**
 * Marks a URL as handled by an active in-app browser auth session
 * so that a concurrent or subsequent global listener event will not navigate twice.
 */
export function markPaymentUrlHandled(url: string | null | undefined) {
  if (url) {
    lastHandledUrl = url;
    lastHandledTimestamp = Date.now();
  }
}

/**
 * Resets the deduplication cache (useful for test isolation).
 */
export function resetPaymentDeepLinkDedupe() {
  lastHandledUrl = null;
  lastHandledTimestamp = 0;
}

export interface NavigationTarget {
  navigate: (
    name: 'OrderDetail',
    params: { orderId: string; paymentHint?: AllowedPaymentHint },
  ) => void;
}

/**
 * Global fallback handler for OS deep links.
 * Returns true if navigation was triggered, false otherwise.
 */
export function handlePaymentDeepLink(
  url: string | null | undefined,
  navigation: NavigationTarget,
): boolean {
  if (!url) {
    return false;
  }

  if (isPaymentUrlHandled(url)) {
    return false;
  }

  const parsed = parsePaymentResultUrl(url);
  if (!parsed) {
    return false;
  }

  markPaymentUrlHandled(url);

  navigation.navigate('OrderDetail', {
    orderId: parsed.orderId,
    paymentHint: parsed.paymentHint,
  });

  return true;
}
