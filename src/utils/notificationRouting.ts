/**
 * Pure parsing and validation utility for notification routing payloads.
 *
 * Adheres strictly to verified navigation targets:
 * - CHAT_MESSAGE -> ChatRoom with conversationId
 * - ORDER_UPDATE -> OrderDetail with orderId
 *
 * Rejects malformed payloads, empty/whitespace IDs, and unknown types without throwing.
 */

import type { NotificationData, NotificationRoute } from '../types/notification';

/**
 * Validates and parses raw notification payload data into a type-safe navigation target.
 * Returns null if the data is malformed, missing required IDs, or an unsupported type.
 */
export function parseNotificationRoute(data: unknown): NotificationRoute | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as Record<string, unknown>;

  if (payload.type === 'CHAT_MESSAGE') {
    const rawConversationId = payload.conversationId;
    if (typeof rawConversationId !== 'string' || rawConversationId.trim().length === 0) {
      return null;
    }

    const conversationId = rawConversationId.trim();

    let counterpartRole: 'CUSTOMER' | 'SELLER' | undefined;
    if (payload.counterpartRole === 'CUSTOMER' || payload.counterpartRole === 'SELLER') {
      counterpartRole = payload.counterpartRole;
    }

    return {
      screen: 'ChatRoom',
      params: {
        conversationId,
        ...(counterpartRole ? { counterpartRole } : {}),
      },
    };
  }

  if (payload.type === 'ORDER_UPDATE') {
    const rawOrderId = payload.orderId;
    if (typeof rawOrderId !== 'string' || rawOrderId.trim().length === 0) {
      return null;
    }

    const orderId = rawOrderId.trim();

    return {
      screen: 'OrderDetail',
      params: {
        orderId,
      },
    };
  }

  return null;
}

/**
 * Type guard for verified NotificationData shapes.
 */
export function isNotificationData(data: unknown): data is NotificationData {
  return parseNotificationRoute(data) !== null;
}
