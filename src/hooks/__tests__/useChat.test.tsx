/**
 * Unit tests for Human Real-Time Customer–Seller Chat TanStack Query hooks.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from '../../services/chatService';
import type {
  ConversationResponse,
  MessageResponse,
  OpenConversationRequest,
  PageResponse,
  SendMessageRequest,
} from '../../types/chatApi';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationRead,
  useOpenConversation,
  useSendMessage,
  type SendMessageVariables,
} from '../useChat';

jest.mock('../../services/chatService', () => ({
  listConversations: jest.fn(),
  openConversation: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  markConversationRead: jest.fn(),
  CHAT_MESSAGES_PAGE_SIZE: 20,
}));

const mockedListConversations = listConversations as jest.MockedFunction<
  typeof listConversations
>;
const mockedOpenConversation = openConversation as jest.MockedFunction<
  typeof openConversation
>;
const mockedListMessages = listMessages as jest.MockedFunction<typeof listMessages>;
const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockedMarkConversationRead = markConversationRead as jest.MockedFunction<
  typeof markConversationRead
>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const mockConversation: ConversationResponse = {
  id: 'conv-1111',
  customerId: 'cust-1111',
  sellerId: 'seller-2222',
  productId: null,
  orderId: null,
  createdAt: '2026-10-30T10:00:00Z',
  lastMessageAt: '2026-10-30T10:05:00Z',
};

const mockMessage1: MessageResponse = {
  id: 'msg-1',
  conversationId: 'conv-1111',
  senderId: 'cust-1111',
  content: 'Tin nhắn 1',
  imageUrl: null,
  isRead: false,
  createdAt: '2026-10-30T10:05:00Z',
};

const mockMessage2: MessageResponse = {
  id: 'msg-2',
  conversationId: 'conv-1111',
  senderId: 'seller-2222',
  content: 'Tin nhắn 2',
  imageUrl: null,
  isRead: true,
  createdAt: '2026-10-30T10:06:00Z',
};

const page0Response: PageResponse<MessageResponse> = {
  content: [mockMessage2],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 2,
};

const page1Response: PageResponse<MessageResponse> = {
  content: [mockMessage1],
  page: 1,
  size: 20,
  totalElements: 2,
  totalPages: 2,
};

describe('useChat hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useConversations', () => {
    it('fetches conversations when enabled', async () => {
      mockedListConversations.mockResolvedValueOnce([mockConversation]);

      const client = makeClient();
      const { result } = renderHook(() => useConversations(true), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedListConversations).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual([mockConversation]);
    });

    it('does not fetch when enabled is false', async () => {
      const client = makeClient();
      const { result } = renderHook(() => useConversations(false), {
        wrapper: wrapper(client),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockedListConversations).not.toHaveBeenCalled();
    });

    it('accepts options object with enabled property', async () => {
      mockedListConversations.mockResolvedValueOnce([mockConversation]);

      const client = makeClient();
      const { result } = renderHook(() => useConversations({ enabled: true }), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedListConversations).toHaveBeenCalled();
    });
  });

  describe('useConversationMessages', () => {
    it('fetches initial page = 0 with default page size', async () => {
      mockedListMessages.mockResolvedValueOnce(page0Response);

      const client = makeClient();
      const { result } = renderHook(() => useConversationMessages('conv-1111'), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedListMessages).toHaveBeenCalledWith('conv-1111', 0, 20);
      expect(result.current.data?.pages[0].content).toEqual([mockMessage2]);
      expect(result.current.hasNextPage).toBe(true);
    });

    it('advances to next page on fetchNextPage', async () => {
      mockedListMessages
        .mockResolvedValueOnce(page0Response)
        .mockResolvedValueOnce(page1Response);

      const client = makeClient();
      const { result } = renderHook(() => useConversationMessages('conv-1111'), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(true);

      result.current.fetchNextPage();

      await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

      expect(mockedListMessages).toHaveBeenLastCalledWith('conv-1111', 1, 20);
      expect(result.current.hasNextPage).toBe(false);
    });

    it('stops pagination when totalPages is reached (currentPage + 1 >= totalPages)', async () => {
      const singlePageResponse: PageResponse<MessageResponse> = {
        content: [mockMessage1],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      };
      mockedListMessages.mockResolvedValueOnce(singlePageResponse);

      const client = makeClient();
      const { result } = renderHook(() => useConversationMessages('conv-1111'), {
        wrapper: wrapper(client),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });

    it('is disabled when conversationId is null, empty, or whitespace', () => {
      const client = makeClient();
      const { result } = renderHook(() => useConversationMessages('  '), {
        wrapper: wrapper(client),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockedListMessages).not.toHaveBeenCalled();
    });
  });

  describe('useOpenConversation', () => {
    it('calls openConversation and invalidates queryKeys.chat.conversations', async () => {
      mockedOpenConversation.mockResolvedValueOnce(mockConversation);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useOpenConversation(), {
        wrapper: wrapper(client),
      });

      const request: OpenConversationRequest = {
        sellerId: 'seller-2222',
        productId: 'prod-999',
      };

      await result.current.mutateAsync(request);

      expect(mockedOpenConversation).toHaveBeenCalledWith(request);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.conversations(),
      });
    });
  });

  describe('useSendMessage', () => {
    it('passes explicit caller-provided idempotencyKey and invalidates messages and conversations', async () => {
      mockedSendMessage.mockResolvedValueOnce(mockMessage1);

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useSendMessage(), {
        wrapper: wrapper(client),
      });

      const variables: SendMessageVariables = {
        conversationId: 'conv-1111',
        request: { content: 'Xin chào' },
        idempotencyKey: 'caller-key-xyz-123',
      };

      await result.current.mutateAsync(variables);

      expect(mockedSendMessage).toHaveBeenCalledWith(
        'conv-1111',
        { content: 'Xin chào' },
        'caller-key-xyz-123',
      );

      // Verifies cache invalidations
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.messages('conv-1111'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.conversations(),
      });
    });

    it('reuses the same idempotencyKey on retry attempt without auto-generating a new key', async () => {
      mockedSendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockMessage1);

      const client = makeClient();
      const { result } = renderHook(() => useSendMessage(), {
        wrapper: wrapper(client),
      });

      const variables: SendMessageVariables = {
        conversationId: 'conv-1111',
        request: { content: 'Thử lại' },
        idempotencyKey: 'same-stable-key-456',
      };

      // First attempt fails
      await expect(result.current.mutateAsync(variables)).rejects.toThrow('Network error');
      expect(mockedSendMessage).toHaveBeenLastCalledWith(
        'conv-1111',
        { content: 'Thử lại' },
        'same-stable-key-456',
      );

      // Retry attempt with same variables
      await result.current.mutateAsync(variables);
      expect(mockedSendMessage).toHaveBeenLastCalledWith(
        'conv-1111',
        { content: 'Thử lại' },
        'same-stable-key-456',
      );
      expect(mockedSendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('useMarkConversationRead', () => {
    it('calls markConversationRead and invalidates conversation messages', async () => {
      mockedMarkConversationRead.mockResolvedValueOnce();

      const client = makeClient();
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

      const { result } = renderHook(() => useMarkConversationRead(), {
        wrapper: wrapper(client),
      });

      await result.current.mutateAsync('conv-1111');

      expect(mockedMarkConversationRead).toHaveBeenCalledWith('conv-1111');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.chat.messages('conv-1111'),
      });
    });
  });
});
