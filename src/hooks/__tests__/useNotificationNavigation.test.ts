import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { navigationRef } from '../../navigation/navigationRef';
import {
  _resetProcessedNotificationResponseCache,
  useNotificationNavigation,
} from '../useNotificationNavigation';

jest.mock('expo-notifications');

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function createMockNotificationResponse(
  identifier: string,
  data: Record<string, unknown>,
  actionIdentifier = Notifications.DEFAULT_ACTION_IDENTIFIER,
): Notifications.NotificationResponse {
  return {
    notification: {
      request: {
        identifier,
        content: {
          title: 'Test Notification',
          subtitle: null,
          body: 'Test Body',
          data,
          sound: 'default',
          categoryIdentifier: null,
        } as unknown as Notifications.NotificationContent,
        trigger: null as any,
      },
      date: 1730000000000,
    },
    actionIdentifier,
  };
}

describe('useNotificationNavigation', () => {
  let responseListenerCallback: ((response: Notifications.NotificationResponse) => void) | null = null;
  const mockSubscription = {
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    _resetProcessedNotificationResponseCache();
    responseListenerCallback = null;

    mockedNotifications.addNotificationResponseReceivedListener.mockImplementation((listener) => {
      responseListenerCallback = listener;
      return mockSubscription as any;
    });

    mockedNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('A. Valid CHAT_MESSAGE tap navigates to ChatRoom', () => {
    it('navigates to ChatRoom with conversationId and counterpartRole when navigation is ready', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      expect(responseListenerCallback).not.toBeNull();

      const response = createMockNotificationResponse('msg-101', {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-101',
        counterpartRole: 'SELLER',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-101',
        counterpartRole: 'SELLER',
      });
    });
  });

  describe('B. Valid ORDER_UPDATE tap navigates to OrderDetail', () => {
    it('navigates to OrderDetail with orderId when navigation is ready', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('order-202', {
        type: 'ORDER_UPDATE',
        orderId: 'order-202',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('OrderDetail', {
        orderId: 'order-202',
      });
    });
  });

  describe('C. Malformed payload does not navigate', () => {
    it('does not navigate when CHAT_MESSAGE is missing conversationId', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('bad-1', {
        type: 'CHAT_MESSAGE',
        conversationId: '',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('does not navigate when ORDER_UPDATE is missing orderId', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('bad-2', {
        type: 'ORDER_UPDATE',
        orderId: '   ',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('does not navigate when data is empty object or null', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      act(() => {
        responseListenerCallback!(createMockNotificationResponse('bad-3', {}));
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('D. Unknown notification type does not navigate', () => {
    it('safely ignores unrecognized notification types without throwing', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('unknown-type', {
        type: 'SYSTEM_MAINTENANCE',
        message: 'Server maintenance tonight',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('E. Navigation not ready queues pending route until onNavigationReady', () => {
    it('defers navigation when navigation is not ready and dispatches upon onNavigationReady()', async () => {
      const isReadySpy = jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      const { result } = renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('queue-1', {
        type: 'ORDER_UPDATE',
        orderId: 'order-queued-55',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      // Not navigated yet because navigationRef is not ready
      expect(navigateSpy).not.toHaveBeenCalled();

      // Navigation becomes ready and onNavigationReady is called
      isReadySpy.mockReturnValue(true);

      act(() => {
        result.current.onNavigationReady();
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('OrderDetail', {
        orderId: 'order-queued-55',
      });

      // Calling onNavigationReady again does not re-navigate
      act(() => {
        result.current.onNavigationReady();
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('F. Cold-start response (getLastNotificationResponseAsync) navigates correctly', () => {
    it('navigates when app is opened cold from a notification tap', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      const coldStartResponse = createMockNotificationResponse('cold-start-999', {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-cold-999',
      });

      mockedNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(coldStartResponse);

      renderHook(() => useNotificationNavigation());

      await waitFor(() => {
        expect(mockedNotifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
        expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
          conversationId: 'conv-cold-999',
          counterpartRole: undefined,
        });
      });
    });

    it('queues cold-start response if navigation is not ready and flushes on onNavigationReady', async () => {
      const isReadySpy = jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      const coldStartResponse = createMockNotificationResponse('cold-start-order-77', {
        type: 'ORDER_UPDATE',
        orderId: 'order-cold-77',
      });

      mockedNotifications.getLastNotificationResponseAsync.mockResolvedValueOnce(coldStartResponse);

      const { result } = renderHook(() => useNotificationNavigation());

      await waitFor(() => {
        expect(mockedNotifications.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
      });

      expect(navigateSpy).not.toHaveBeenCalled();

      // Container finishes mounting
      isReadySpy.mockReturnValue(true);
      act(() => {
        result.current.onNavigationReady();
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('OrderDetail', {
        orderId: 'order-cold-77',
      });
    });
  });

  describe('G. Duplicate response (same notification identifier) is handled only once', () => {
    it('deduplicates duplicate responses with identical identifier', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response = createMockNotificationResponse('duplicate-id-1', {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-dup-1',
      });

      act(() => {
        responseListenerCallback!(response);
      });

      // Duplicate delivery of the exact same notification response
      act(() => {
        responseListenerCallback!(response);
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-dup-1',
        counterpartRole: undefined,
      });
    });
  });

  describe('H. Different notification interactions are handled independently', () => {
    it('navigates independently for distinct notifications', async () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      const response1 = createMockNotificationResponse('id-alpha', {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-alpha',
      });

      const response2 = createMockNotificationResponse('id-beta', {
        type: 'ORDER_UPDATE',
        orderId: 'order-beta',
      });

      act(() => {
        responseListenerCallback!(response1);
      });

      act(() => {
        responseListenerCallback!(response2);
      });

      expect(navigateSpy).toHaveBeenCalledTimes(2);
      expect(navigateSpy).toHaveBeenNthCalledWith(1, 'ChatRoom', {
        conversationId: 'conv-alpha',
        counterpartRole: undefined,
      });
      expect(navigateSpy).toHaveBeenNthCalledWith(2, 'OrderDetail', {
        orderId: 'order-beta',
      });
    });
  });

  describe('I. Listener cleanup: subscription.remove() is called on unmount', () => {
    it('unsubscribes notification response listener on unmount', () => {
      const { unmount } = renderHook(() => useNotificationNavigation());

      expect(mockSubscription.remove).not.toHaveBeenCalled();

      unmount();

      expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    });

    it('does not navigate if response arrives after unmount', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      const { unmount } = renderHook(() => useNotificationNavigation());

      unmount();

      act(() => {
        responseListenerCallback?.(
          createMockNotificationResponse('after-unmount', {
            type: 'CHAT_MESSAGE',
            conversationId: 'conv-late',
          }),
        );
      });

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });

  describe('J. Passive notification receipt without user tap does not navigate', () => {
    it('verifies useNotificationNavigation does not listen to addNotificationReceivedListener', () => {
      renderHook(() => useNotificationNavigation());

      // Passive notification arrival (addNotificationReceivedListener) must NOT be subscribed here,
      // because simply receiving a notification while looking at another screen must never abruptly navigate away.
      expect(mockedNotifications.addNotificationReceivedListener).not.toHaveBeenCalled();
      expect(mockedNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('K. Optional counterpartRole preserved when valid, routes safely when absent', () => {
    it('preserves counterpartRole CUSTOMER when provided', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      act(() => {
        responseListenerCallback!(
          createMockNotificationResponse('role-cust', {
            type: 'CHAT_MESSAGE',
            conversationId: 'conv-c1',
            counterpartRole: 'CUSTOMER',
          }),
        );
      });

      expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-c1',
        counterpartRole: 'CUSTOMER',
      });
    });

    it('preserves counterpartRole SELLER when provided', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      act(() => {
        responseListenerCallback!(
          createMockNotificationResponse('role-seller', {
            type: 'CHAT_MESSAGE',
            conversationId: 'conv-s1',
            counterpartRole: 'SELLER',
          }),
        );
      });

      expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-s1',
        counterpartRole: 'SELLER',
      });
    });

    it('sets counterpartRole to undefined when absent', () => {
      jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
      const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

      renderHook(() => useNotificationNavigation());

      act(() => {
        responseListenerCallback!(
          createMockNotificationResponse('role-none', {
            type: 'CHAT_MESSAGE',
            conversationId: 'conv-s2',
          }),
        );
      });

      expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-s2',
        counterpartRole: undefined,
      });
    });
  });

  describe('Prohibited methods audit', () => {
    it('verifies useNotificationNavigation does not invoke remote push token methods', () => {
      renderHook(() => useNotificationNavigation());

      expect(mockedNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    });
  });
});
