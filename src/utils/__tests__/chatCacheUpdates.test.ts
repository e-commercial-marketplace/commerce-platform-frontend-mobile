import { QueryClient, type InfiniteData } from '@tanstack/react-query';

import { queryKeys } from '../../api/queryKeys';
import type {
  ConversationResponse,
  MessageCreatedEvent,
  MessageResponse,
  MessagesReadEvent,
  PageResponse,
} from '../../types/chatApi';
import {
  handleChatMessageCreated,
  handleChatMessagesRead,
  resyncChatQueries,
} from '../chatCacheUpdates';

describe('chatCacheUpdates', () => {
  let queryClient: QueryClient;

  const mockMessage1: MessageResponse = {
    id: 'msg-1',
    conversationId: 'conv-100',
    senderId: 'cust-1',
    content: 'Hello shop',
    imageUrl: null,
    isRead: false,
    createdAt: '2026-10-30T10:00:00Z',
  };

  const mockMessage2: MessageResponse = {
    id: 'msg-2',
    conversationId: 'conv-100',
    senderId: 'seller-2',
    content: 'Shop nghe day',
    imageUrl: null,
    isRead: false,
    createdAt: '2026-10-30T10:01:00Z',
  };

  const mockConversation: ConversationResponse = {
    id: 'conv-100',
    customerId: 'cust-1',
    sellerId: 'seller-2',
    productId: null,
    orderId: null,
    createdAt: '2026-10-30T09:00:00Z',
    lastMessageAt: '2026-10-30T10:00:00Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
  });

  describe('handleChatMessageCreated', () => {
    it('prepends new message to page 0 and updates totalElements', () => {
      const initialCache: InfiniteData<PageResponse<MessageResponse>> = {
        pages: [
          {
            content: [mockMessage1],
            page: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
          },
        ],
        pageParams: [0],
      };

      queryClient.setQueryData(queryKeys.chat.messages('conv-100'), initialCache);

      const event: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message: mockMessage2,
      };

      handleChatMessageCreated(queryClient, event);

      const cached = queryClient.getQueryData<InfiniteData<PageResponse<MessageResponse>>>(
        queryKeys.chat.messages('conv-100'),
      );

      expect(cached?.pages[0].content).toHaveLength(2);
      expect(cached?.pages[0].content[0]).toEqual(mockMessage2);
      expect(cached?.pages[0].content[1]).toEqual(mockMessage1);
      expect(cached?.pages[0].totalElements).toBe(2);
    });

    it('enforces canonical deduplication by message.id: does not duplicate existing message', () => {
      // Both REST response and WS event represent the same message
      const initialCache: InfiniteData<PageResponse<MessageResponse>> = {
        pages: [
          {
            content: [mockMessage1],
            page: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
          },
        ],
        pageParams: [0],
      };

      queryClient.setQueryData(queryKeys.chat.messages('conv-100'), initialCache);

      // Same message arrives again via WS
      const duplicateEvent: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message: mockMessage1,
      };

      handleChatMessageCreated(queryClient, duplicateEvent);

      const cached = queryClient.getQueryData<InfiniteData<PageResponse<MessageResponse>>>(
        queryKeys.chat.messages('conv-100'),
      );

      expect(cached?.pages[0].content).toHaveLength(1);
      expect(cached?.pages[0].content[0].id).toBe('msg-1');
      expect(cached?.pages[0].totalElements).toBe(1);
    });

    it('updates lastMessageAt in conversation list and invalidates conversations query', () => {
      queryClient.setQueryData(queryKeys.chat.conversations(), [mockConversation]);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const event: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message: mockMessage2,
      };

      handleChatMessageCreated(queryClient, event);

      const conversations = queryClient.getQueryData<ConversationResponse[]>(
        queryKeys.chat.conversations(),
      );

      expect(conversations?.[0].lastMessageAt).toBe(mockMessage2.createdAt);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.conversations(),
      });
    });

    it('does not throw if message cache is not yet loaded', () => {
      const event: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message: mockMessage1,
      };

      expect(() => handleChatMessageCreated(queryClient, event)).not.toThrow();
    });
  });

  describe('handleChatMessagesRead', () => {
    it('marks unread messages from counterpart as isRead = true', () => {
      // Message 1 was sent by cust-1 (unread)
      const initialCache: InfiniteData<PageResponse<MessageResponse>> = {
        pages: [
          {
            content: [{ ...mockMessage1, isRead: false }],
            page: 0,
            size: 20,
            totalElements: 1,
            totalPages: 1,
          },
        ],
        pageParams: [0],
      };

      queryClient.setQueryData(queryKeys.chat.messages('conv-100'), initialCache);

      // Reader is seller-2
      const readEvent: MessagesReadEvent = {
        type: 'MESSAGES_READ',
        conversationId: 'conv-100',
        readerId: 'seller-2',
      };

      handleChatMessagesRead(queryClient, readEvent);

      const cached = queryClient.getQueryData<InfiniteData<PageResponse<MessageResponse>>>(
        queryKeys.chat.messages('conv-100'),
      );

      expect(cached?.pages[0].content[0].isRead).toBe(true);
    });

    it('invalidates conversation messages query', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const readEvent: MessagesReadEvent = {
        type: 'MESSAGES_READ',
        conversationId: 'conv-100',
        readerId: 'seller-2',
      };

      handleChatMessagesRead(queryClient, readEvent);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.messages('conv-100'),
      });
    });
  });

  describe('resyncChatQueries', () => {
    it('invalidates chat conversations and chat.all queries', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      resyncChatQueries(queryClient);

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.conversations(),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.all,
      });
    });
  });
});
