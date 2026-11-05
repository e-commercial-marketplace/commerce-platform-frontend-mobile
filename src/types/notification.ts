/**
 * Notification types for Native Push Notifications (Phase 1 Frontend Foundation).
 *
 * Strict, minimal model supporting only verified local notification routing payloads:
 * - CHAT_MESSAGE -> ChatRoom
 * - ORDER_UPDATE -> OrderDetail
 *
 * Speculative fields (unreadCount, message text, customer/seller names, fake backend IDs)
 * are strictly omitted.
 */

export type ChatMessageNotificationData = {
  type: 'CHAT_MESSAGE';
  conversationId: string;
  counterpartRole?: 'CUSTOMER' | 'SELLER';
};

export type OrderUpdateNotificationData = {
  type: 'ORDER_UPDATE';
  orderId: string;
};

export type NotificationData =
  | ChatMessageNotificationData
  | OrderUpdateNotificationData;

export type NotificationRoute =
  | {
      screen: 'ChatRoom';
      params: {
        conversationId: string;
        counterpartRole?: 'CUSTOMER' | 'SELLER';
      };
    }
  | {
      screen: 'OrderDetail';
      params: {
        orderId: string;
      };
    };
