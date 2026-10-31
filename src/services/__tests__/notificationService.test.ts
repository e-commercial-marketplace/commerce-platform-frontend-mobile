import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import {
  NOTIFICATION_CHANNEL_CHAT,
  NOTIFICATION_CHANNEL_DEFAULT,
  NOTIFICATION_CHANNEL_ORDERS,
  _resetNotificationFoundationState,
  configureNotificationHandler,
  initializeNotificationFoundation,
  isPhysicalHardwareDevice,
  requestNotificationPermissions,
  scheduleLocalTestNotification,
  setupAndroidNotificationChannels,
} from '../notificationService';
import type { ChatMessageNotificationData, OrderUpdateNotificationData } from '../../types/notification';

jest.mock('expo-notifications');
jest.mock('expo-device');

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockedDevice = Device as { isDevice: boolean };

describe('notificationService', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetNotificationFoundationState();
    (Platform as any).OS = 'android';
  });

  afterEach(() => {
    (Platform as any).OS = originalPlatform;
  });

  describe('configureNotificationHandler', () => {
    it('configures foreground notification presentation behavior', () => {
      configureNotificationHandler();

      expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledWith({
        handleNotification: expect.any(Function),
      });
    });
  });

  describe('setupAndroidNotificationChannels', () => {
    it('creates default, chat-messages, and order-updates channels on Android', async () => {
      (Platform as any).OS = 'android';
      mockedNotifications.setNotificationChannelAsync.mockResolvedValue(null);

      await setupAndroidNotificationChannels();

      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        NOTIFICATION_CHANNEL_DEFAULT,
        expect.objectContaining({
          name: 'Thông báo chung',
          importance: Notifications.AndroidImportance.DEFAULT,
        }),
      );

      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        NOTIFICATION_CHANNEL_CHAT,
        expect.objectContaining({
          name: 'Tin nhắn trò chuyện',
          importance: Notifications.AndroidImportance.HIGH,
        }),
      );

      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        NOTIFICATION_CHANNEL_ORDERS,
        expect.objectContaining({
          name: 'Cập nhật đơn hàng',
          importance: Notifications.AndroidImportance.HIGH,
        }),
      );
    });

    it('does not create notification channels when running on iOS or non-Android platform', async () => {
      (Platform as any).OS = 'ios';

      await setupAndroidNotificationChannels();

      expect(mockedNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });

  describe('requestNotificationPermissions', () => {
    it('returns granted immediately if existing permission is already GRANTED without prompting', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValueOnce({
        status: Notifications.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.NotificationPermissionsStatus);

      const result = await requestNotificationPermissions();

      expect(result).toEqual({
        status: Notifications.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
      });
      expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('prompts user if existing status is UNDETERMINED and returns result', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValueOnce({
        status: Notifications.PermissionStatus.UNDETERMINED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.NotificationPermissionsStatus);

      mockedNotifications.requestPermissionsAsync.mockResolvedValueOnce({
        status: Notifications.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: 'never',
      } as Notifications.NotificationPermissionsStatus);

      const result = await requestNotificationPermissions();

      expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        status: Notifications.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
      });
    });

    it('handles denied permission gracefully without repeated prompts when canAskAgain is false', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValueOnce({
        status: Notifications.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: false,
        expires: 'never',
      } as Notifications.NotificationPermissionsStatus);

      const result = await requestNotificationPermissions();

      expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: Notifications.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: false,
      });
    });
  });

  describe('isPhysicalHardwareDevice', () => {
    it('returns true when Device.isDevice is true', () => {
      mockedDevice.isDevice = true;
      expect(isPhysicalHardwareDevice()).toBe(true);
    });

    it('returns false when running on simulator / emulator', () => {
      mockedDevice.isDevice = false;
      expect(isPhysicalHardwareDevice()).toBe(false);
    });
  });

  describe('scheduleLocalTestNotification', () => {
    it('schedules local notification for CHAT_MESSAGE on chat channel', async () => {
      (Platform as any).OS = 'android';
      mockedNotifications.scheduleNotificationAsync.mockResolvedValueOnce('local-notif-123');

      const chatData: ChatMessageNotificationData = {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-test-1',
        counterpartRole: 'SELLER',
      };

      const id = await scheduleLocalTestNotification({
        title: 'Tin nhắn mới',
        body: 'Bạn có tin nhắn từ Shop TechStore',
        data: chatData,
      });

      expect(id).toBe('local-notif-123');
      expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Tin nhắn mới',
          body: 'Bạn có tin nhắn từ Shop TechStore',
          data: chatData,
          channelId: NOTIFICATION_CHANNEL_CHAT,
        },
        trigger: null,
      });
    });

    it('schedules local notification for ORDER_UPDATE on orders channel', async () => {
      (Platform as any).OS = 'android';
      mockedNotifications.scheduleNotificationAsync.mockResolvedValueOnce('local-notif-456');

      const orderData: OrderUpdateNotificationData = {
        type: 'ORDER_UPDATE',
        orderId: 'order-test-2',
      };

      const id = await scheduleLocalTestNotification({
        title: 'Đơn hàng đã giao',
        body: 'Đơn hàng #order-test-2 đã được giao thành công',
        data: orderData,
      });

      expect(id).toBe('local-notif-456');
      expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Đơn hàng đã giao',
          body: 'Đơn hàng #order-test-2 đã được giao thành công',
          data: orderData,
          channelId: NOTIFICATION_CHANNEL_ORDERS,
        },
        trigger: null,
      });
    });

    it('omits channelId on iOS platforms', async () => {
      (Platform as any).OS = 'ios';
      mockedNotifications.scheduleNotificationAsync.mockResolvedValueOnce('local-notif-ios');

      const orderData: OrderUpdateNotificationData = {
        type: 'ORDER_UPDATE',
        orderId: 'order-test-3',
      };

      await scheduleLocalTestNotification({
        title: 'Cập nhật',
        body: 'Đơn hàng mới',
        data: orderData,
      });

      expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Cập nhật',
          body: 'Đơn hàng mới',
          data: orderData,
        },
        trigger: null,
      });
    });
  });

  describe('initializeNotificationFoundation', () => {
    it('initializes notification handler and channels on first call', async () => {
      (Platform as any).OS = 'android';
      mockedNotifications.setNotificationChannelAsync.mockResolvedValue(null);

      await initializeNotificationFoundation();

      expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    });

    it('does not re-initialize on subsequent calls', async () => {
      (Platform as any).OS = 'android';
      mockedNotifications.setNotificationChannelAsync.mockResolvedValue(null);

      await initializeNotificationFoundation();
      await initializeNotificationFoundation();

      expect(mockedNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledTimes(3);
    });

    it('does not crash or throw if notification setup fails', async () => {
      mockedNotifications.setNotificationHandler.mockImplementationOnce(() => {
        throw new Error('Native notification module unavailable');
      });

      await expect(initializeNotificationFoundation()).resolves.toBeUndefined();
    });
  });

  describe('Prohibited methods audit', () => {
    it('verifies notification service does NOT call remote token generation methods', () => {
      // getExpoPushTokenAsync and getDevicePushTokenAsync must not be defined or called in notificationService
      const serviceModule = require('../notificationService');
      expect(serviceModule.getExpoPushTokenAsync).toBeUndefined();
      expect(serviceModule.getDevicePushTokenAsync).toBeUndefined();
      expect(mockedNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    });
  });
});
