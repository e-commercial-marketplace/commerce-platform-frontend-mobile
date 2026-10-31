/**
 * React hook for notification response (tap) handling and type-safe navigation routing.
 *
 * Responsibilities:
 * - Listens for user notification interactions via `addNotificationResponseReceivedListener`.
 * - Handles cold-start notification response via `getLastNotificationResponseAsync`.
 * - Enforces deterministic deduplication so a single tap never triggers double navigation.
 * - Defers navigation safely until `NavigationContainer` is ready (no sleep/setTimeout hacks).
 * - Routes strictly to validated targets: `ChatRoom` with conversationId, `OrderDetail` with orderId.
 * - Rejects malformed/unsupported payloads silently without crashing.
 * - Cleans up event subscriptions on unmount.
 */

import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { navigationRef, navigateToNotificationRoute } from '../navigation/navigationRef';
import type { NotificationRoute } from '../types/notification';
import { parseNotificationRoute } from '../utils/notificationRouting';

/** Cache of processed notification interaction IDs to prevent duplicate navigation. */
const processedResponseIds = new Set<string>();

/** Maximum size for processed ID cache to prevent unbounded growth. */
const MAX_CACHE_SIZE = 100;

function trackProcessedResponse(identifier: string): boolean {
  if (processedResponseIds.has(identifier)) {
    return false; // Already processed
  }
  if (processedResponseIds.size >= MAX_CACHE_SIZE) {
    const firstKey = processedResponseIds.values().next().value;
    if (firstKey) {
      processedResponseIds.delete(firstKey);
    }
  }
  processedResponseIds.add(identifier);
  return true;
}

/** Helper for unit tests to clear processed ID cache. */
export function _resetProcessedNotificationResponseCache(): void {
  processedResponseIds.clear();
}

export type UseNotificationNavigationResult = {
  onNavigationReady: () => void;
};

export function useNotificationNavigation(): UseNotificationNavigationResult {
  const pendingRouteRef = useRef<NotificationRoute | null>(null);
  const isMountedRef = useRef(true);

  const dispatchOrQueueRoute = useCallback((route: NotificationRoute) => {
    if (navigationRef.isReady()) {
      navigateToNotificationRoute(route);
      pendingRouteRef.current = null;
    } else {
      pendingRouteRef.current = route;
    }
  }, []);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;

      const identifier =
        response.notification.request.identifier ||
        `${response.notification.date}_${response.actionIdentifier}`;

      if (!trackProcessedResponse(identifier)) {
        return; // Deduplicated
      }

      const rawData = response.notification.request.content.data;
      const targetRoute = parseNotificationRoute(rawData);

      if (targetRoute) {
        dispatchOrQueueRoute(targetRoute);
      }
    },
    [dispatchOrQueueRoute],
  );

  // 1. Subscribe to notification interaction events while app is running
  useEffect(() => {
    isMountedRef.current = true;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isMountedRef.current) {
        handleNotificationResponse(response);
      }
    });

    // 2. Check for cold-start notification response (app opened from terminated state via tap)
    const checkColdStartResponse = async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (isMountedRef.current && lastResponse) {
          handleNotificationResponse(lastResponse);
        }
      } catch {
        // Fail gracefully without crashing
      }
    };

    void checkColdStartResponse();

    return () => {
      isMountedRef.current = false;
      subscription.remove();
    };
  }, [handleNotificationResponse]);

  // Callback to be invoked when NavigationContainer finishes mounting
  const onNavigationReady = useCallback(() => {
    if (pendingRouteRef.current && navigationRef.isReady()) {
      navigateToNotificationRoute(pendingRouteRef.current);
      pendingRouteRef.current = null;
    }
  }, []);

  return {
    onNavigationReady,
  };
}
