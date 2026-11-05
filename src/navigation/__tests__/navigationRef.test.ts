import { navigationRef, navigateToNotificationRoute } from '../navigationRef';
import type { NotificationRoute } from '../../types/notification';

describe('navigationRef', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false and does not throw when navigationRef is not ready', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(false);
    const navigateSpy = jest.spyOn(navigationRef, 'navigate');

    const route: NotificationRoute = {
      screen: 'ChatRoom',
      params: { conversationId: 'conv-123' },
    };

    const result = navigateToNotificationRoute(route);

    expect(result).toBe(false);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('navigates to ChatRoom when navigationRef is ready', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

    const route: NotificationRoute = {
      screen: 'ChatRoom',
      params: {
        conversationId: 'conv-456',
        counterpartRole: 'SELLER',
      },
    };

    const result = navigateToNotificationRoute(route);

    expect(result).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('ChatRoom', {
      conversationId: 'conv-456',
      counterpartRole: 'SELLER',
    });
  });

  it('navigates to OrderDetail when navigationRef is ready', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation();

    const route: NotificationRoute = {
      screen: 'OrderDetail',
      params: {
        orderId: 'order-789',
      },
    };

    const result = navigateToNotificationRoute(route);

    expect(result).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('OrderDetail', {
      orderId: 'order-789',
    });
  });
});
