/**
 * Native Push Notifications Service — Phase 1 Frontend Foundation.
 *
 * Responsibilities:
 * - Configure foreground notification presentation handler.
 * - Configure Android notification channels (default, chat-messages, order-updates).
 * - Request and check notification permissions safely.
 * - Provide local test notification scheduling helper for validation.
 *
 * PROHIBITED IN PHASE 1 (Strictly omitted):
 * - getExpoPushTokenAsync / getDevicePushTokenAsync
 * - Fake backend registration APIs
 * - Dummy EAS projectId
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import type { NotificationData } from '../types/notification';

export const NOTIFICATION_CHANNEL_DEFAULT = 'default';
export const NOTIFICATION_CHANNEL_CHAT = 'chat-messages';
export const NOTIFICATION_CHANNEL_ORDERS = 'order-updates';

export type NotificationPermissionResult = {
  status: Notifications.PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
};

let isFoundationInitialized = false;

/**
 * Sets foreground notification presentation behavior.
 * Shows banner and alert in foreground while suppressing sound/badge if needed.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Creates explicit Android notification channels required for Android 8.0+ (API 26+).
 * Safe no-op on iOS and Web.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_DEFAULT, {
    name: 'General notifications',
    description: 'General notifications from the system',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_CHAT, {
    name: 'Chat messages',
    description: 'Notifications about new messages from buyers or sellers',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ORDERS, {
    name: 'Order updates',
    description: 'Notifications about order status and payment updates',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Requests notification permissions from the OS.
 * Checks existing permission state first to avoid duplicate prompts.
 */
export async function requestNotificationPermissions(): Promise<NotificationPermissionResult> {
  const existingSettings = await Notifications.getPermissionsAsync();

  if (existingSettings.granted || existingSettings.status === Notifications.PermissionStatus.GRANTED) {
    return {
      status: Notifications.PermissionStatus.GRANTED,
      granted: true,
      canAskAgain: existingSettings.canAskAgain,
    };
  }

  if (existingSettings.canAskAgain || existingSettings.status === Notifications.PermissionStatus.UNDETERMINED) {
    const requestResult = await Notifications.requestPermissionsAsync();
    return {
      status: requestResult.status,
      granted: requestResult.granted || requestResult.status === Notifications.PermissionStatus.GRANTED,
      canAskAgain: requestResult.canAskAgain,
    };
  }

  return {
    status: existingSettings.status,
    granted: false,
    canAskAgain: existingSettings.canAskAgain,
  };
}

/**
 * Checks whether the current runtime environment is a physical hardware device.
 */
export function isPhysicalHardwareDevice(): boolean {
  return Device.isDevice;
}

/**
 * LOCAL TESTING ONLY: Schedules an immediate local notification with verified payload data.
 * Used exclusively for local validation of foreground display and tap-to-route behavior.
 *
 * NOTE: This is NOT server push. It does not communicate with any external backend.
 */
export async function scheduleLocalTestNotification(params: {
  title: string;
  body: string;
  data: NotificationData;
  channelId?: string;
}): Promise<string> {
  const channelId =
    params.channelId ??
    (params.data.type === 'CHAT_MESSAGE'
      ? NOTIFICATION_CHANNEL_CHAT
      : NOTIFICATION_CHANNEL_ORDERS);

  return await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: params.data,
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
    trigger: null, // immediate presentation
  });
}

/**
 * Initializes notification foundation once during application startup.
 * Sets the notification handler and configures Android notification channels.
 */
export async function initializeNotificationFoundation(): Promise<void> {
  if (isFoundationInitialized) {
    return;
  }
  isFoundationInitialized = true;

  try {
    configureNotificationHandler();
    await setupAndroidNotificationChannels();
  } catch {
    // Fail silently to prevent notification errors from interrupting app initialization
  }
}

/**
 * Test helper to reset initialization state for unit tests.
 */
export function _resetNotificationFoundationState(): void {
  isFoundationInitialized = false;
}
