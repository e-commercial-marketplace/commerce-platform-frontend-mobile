import { isNotificationData, parseNotificationRoute } from '../notificationRouting';

describe('notificationRouting', () => {
  describe('CHAT_MESSAGE parsing', () => {
    it('parses valid CHAT_MESSAGE with conversationId and counterpartRole', () => {
      const payload = {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-1234',
        counterpartRole: 'SELLER',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'ChatRoom',
        params: {
          conversationId: 'conv-1234',
          counterpartRole: 'SELLER',
        },
      });
      expect(isNotificationData(payload)).toBe(true);
    });

    it('parses valid CHAT_MESSAGE without counterpartRole', () => {
      const payload = {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-5678',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'ChatRoom',
        params: {
          conversationId: 'conv-5678',
        },
      });
      expect(isNotificationData(payload)).toBe(true);
    });

    it('handles invalid counterpartRole safely by omitting it', () => {
      const payload = {
        type: 'CHAT_MESSAGE',
        conversationId: 'conv-1234',
        counterpartRole: 'INVALID_ROLE',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'ChatRoom',
        params: {
          conversationId: 'conv-1234',
        },
      });
    });

    it('trims whitespace from conversationId', () => {
      const payload = {
        type: 'CHAT_MESSAGE',
        conversationId: '   conv-spaced-999   ',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'ChatRoom',
        params: {
          conversationId: 'conv-spaced-999',
        },
      });
    });

    it('rejects CHAT_MESSAGE with missing conversationId', () => {
      const payload = {
        type: 'CHAT_MESSAGE',
      };

      expect(parseNotificationRoute(payload)).toBeNull();
      expect(isNotificationData(payload)).toBe(false);
    });

    it('rejects CHAT_MESSAGE with empty or whitespace-only conversationId', () => {
      expect(
        parseNotificationRoute({
          type: 'CHAT_MESSAGE',
          conversationId: '',
        }),
      ).toBeNull();

      expect(
        parseNotificationRoute({
          type: 'CHAT_MESSAGE',
          conversationId: '   ',
        }),
      ).toBeNull();
    });

    it('rejects CHAT_MESSAGE with non-string conversationId', () => {
      expect(
        parseNotificationRoute({
          type: 'CHAT_MESSAGE',
          conversationId: 12345,
        }),
      ).toBeNull();
    });
  });

  describe('ORDER_UPDATE parsing', () => {
    it('parses valid ORDER_UPDATE with orderId', () => {
      const payload = {
        type: 'ORDER_UPDATE',
        orderId: 'order-uuid-abc',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'OrderDetail',
        params: {
          orderId: 'order-uuid-abc',
        },
      });
      expect(isNotificationData(payload)).toBe(true);
    });

    it('trims whitespace from orderId', () => {
      const payload = {
        type: 'ORDER_UPDATE',
        orderId: '  order-trimmed-123  ',
      };

      const result = parseNotificationRoute(payload);

      expect(result).toEqual({
        screen: 'OrderDetail',
        params: {
          orderId: 'order-trimmed-123',
        },
      });
    });

    it('rejects ORDER_UPDATE with missing orderId', () => {
      const payload = {
        type: 'ORDER_UPDATE',
      };

      expect(parseNotificationRoute(payload)).toBeNull();
      expect(isNotificationData(payload)).toBe(false);
    });

    it('rejects ORDER_UPDATE with empty or whitespace-only orderId', () => {
      expect(
        parseNotificationRoute({
          type: 'ORDER_UPDATE',
          orderId: '',
        }),
      ).toBeNull();

      expect(
        parseNotificationRoute({
          type: 'ORDER_UPDATE',
          orderId: '   ',
        }),
      ).toBeNull();
    });

    it('rejects ORDER_UPDATE with non-string orderId', () => {
      expect(
        parseNotificationRoute({
          type: 'ORDER_UPDATE',
          orderId: { id: 'order-123' },
        }),
      ).toBeNull();
    });
  });

  describe('Malformed and unsupported payloads', () => {
    it('returns null for null, undefined, primitives', () => {
      expect(parseNotificationRoute(null)).toBeNull();
      expect(parseNotificationRoute(undefined)).toBeNull();
      expect(parseNotificationRoute('string')).toBeNull();
      expect(parseNotificationRoute(123)).toBeNull();
      expect(parseNotificationRoute(true)).toBeNull();
    });

    it('returns null for empty object', () => {
      expect(parseNotificationRoute({})).toBeNull();
    });

    it('returns null for unknown notification types', () => {
      expect(
        parseNotificationRoute({
          type: 'UNKNOWN_TYPE',
          someId: '123',
        }),
      ).toBeNull();

      expect(
        parseNotificationRoute({
          type: 'PROMOTION',
          discount: 20,
        }),
      ).toBeNull();
    });
  });
});
