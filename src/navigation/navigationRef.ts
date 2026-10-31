/**
 * Root navigation reference and type-safe notification routing helper.
 *
 * Provides safe navigation capability outside of React component trees
 * (e.g. for app-level notification response event handlers).
 *
 * Checks `navigationRef.isReady()` to prevent throwing when navigation is not yet initialized.
 */

import { createNavigationContainerRef } from '@react-navigation/native';

import type { NotificationRoute } from '../types/notification';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Safely navigates to a validated notification route if the NavigationContainer is mounted and ready.
 * Returns true if navigation was successfully dispatched, or false if navigation is not ready.
 */
export function navigateToNotificationRoute(route: NotificationRoute): boolean {
  if (!navigationRef.isReady()) {
    return false;
  }

  if (route.screen === 'ChatRoom') {
    navigationRef.navigate('ChatRoom', route.params);
    return true;
  }

  if (route.screen === 'OrderDetail') {
    navigationRef.navigate('OrderDetail', route.params);
    return true;
  }

  return false;
}
