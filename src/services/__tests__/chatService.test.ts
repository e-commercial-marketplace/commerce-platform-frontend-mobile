/**
 * Unit tests for Human Real-Time Customer–Seller Chat REST service.
 */

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type {
  ConversationResponse,
  MessageResponse,
  OpenConversationRequest,
  PageResponse,
  SendMessageRequest,
} from '../../types/chatApi';
import {
  CHAT_MESSAGES_PAGE_SIZE,
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from '../chatService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const mockConversation: ConversationResponse = {
  id: 'conv-1111-2222',
  customerId: 'cust-1111',
  sellerId: 'seller-2222',
  productId: 'prod-3333',
  orderId: null,
  createdAt: '2026-10-30T10:00:00Z',
  lastMessageAt: '2026-10-30T10:05:00Z',
};

const mockMessage: MessageResponse = {
  id: 'msg-9999',
  conversationId: 'conv-1111-2222',
  senderId: 'cust-1111',
  content: 'Is it in stock?',
  imageUrl: null,
  isRead: false,
  createdAt: '2026-10-30T10:05:00Z',
};

const mockPageResponse: PageResponse<MessageResponse> = {
  content: [mockMessage],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listConversations', () => {
    it('calls GET /conversations and unwraps conversations array', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: [mockConversation],
        },
        status: 200,
      } as any);

      const result = await listConversations();

      expect(mockedClient.get).toHaveBeenCalledWith('/conversations');
      expect(result).toEqual([mockConversation]);
      expect(result[0].customerId).toBe('cust-1111');
      expect(result[0].sellerId).toBe('seller-2222');
    });

    it('propagates ApiError on 401 Unauthorized', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
          },
        },
        status: 401,
      } as any);

      await expect(listConversations()).rejects.toThrow(ApiError);
    });

    it('propagates ApiError on 403 Forbidden (e.g. ADMIN role)', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        },
        status: 403,
      } as any);

      await expect(listConversations()).rejects.toThrow(ApiError);
    });
  });

  describe('openConversation', () => {
    it('calls POST /conversations with customer request body and unwraps conversation', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockConversation,
        },
        status: 201,
      } as any);

      const request: OpenConversationRequest = {
        sellerId: 'seller-2222',
        productId: 'prod-3333',
      };

      const result = await openConversation(request);

      expect(mockedClient.post).toHaveBeenCalledWith('/conversations', request);
      expect(result).toEqual(mockConversation);
      expect(result.id).toBe('conv-1111-2222');
    });

    it('supports seller opening conversation with customerId', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockConversation,
        },
        status: 200,
      } as any);

      const request: OpenConversationRequest = {
        customerId: 'cust-1111',
      };

      const result = await openConversation(request);

      expect(mockedClient.post).toHaveBeenCalledWith('/conversations', request);
      expect(result).toEqual(mockConversation);
    });

    it('propagates ApiError on counterpart not found (404 RESOURCE_NOT_FOUND)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Seller not found or not approved',
          },
        },
        status: 404,
      } as any);

      await expect(openConversation({ sellerId: 'invalid-seller' })).rejects.toThrow(ApiError);
    });
  });

  describe('listMessages', () => {
    it('calls GET /conversations/{id}/messages with default page=0 and size=20', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockPageResponse,
        },
        status: 200,
      } as any);

      const result = await listMessages('conv-1111-2222');

      expect(mockedClient.get).toHaveBeenCalledWith('/conversations/conv-1111-2222/messages', {
        params: { page: 0, size: CHAT_MESSAGES_PAGE_SIZE },
      });
      expect(result).toEqual(mockPageResponse);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].content).toBe('Is it in stock?');
    });

    it('passes custom page and size parameters when supplied', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { ...mockPageResponse, page: 2, size: 50 },
        },
        status: 200,
      } as any);

      await listMessages('conv-1111-2222', 2, 50);

      expect(mockedClient.get).toHaveBeenCalledWith('/conversations/conv-1111-2222/messages', {
        params: { page: 2, size: 50 },
      });
    });

    it('encodes URI component for conversationId in URL path', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockPageResponse,
        },
        status: 200,
      } as any);

      await listMessages('conv/special/id');

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/conversations/conv%2Fspecial%2Fid/messages',
        expect.any(Object),
      );
    });

    it('propagates ApiError on non-participant 404 RESOURCE_NOT_FOUND', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Conversation not found',
          },
        },
        status: 404,
      } as any);

      await expect(listMessages('other-conversation')).rejects.toThrow(ApiError);
    });
  });

  describe('sendMessage', () => {
    it('calls POST /conversations/{id}/messages with exact Idempotency-Key header', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockMessage,
        },
        status: 201,
      } as any);

      const request: SendMessageRequest = {
        content: 'Is it in stock?',
      };
      const key = 'client-key-12345';

      const result = await sendMessage('conv-1111-2222', request, key);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/conversations/conv-1111-2222/messages',
        request,
        {
          headers: {
            'Idempotency-Key': key,
          },
        },
      );
      expect(result).toEqual(mockMessage);
      expect(result.senderId).toBe('cust-1111');
      expect(result.isRead).toBe(false);
    });

    it('supports imageUrl with optional or empty content', async () => {
      const imageMsg: MessageResponse = {
        ...mockMessage,
        content: null,
        imageUrl: 'https://example.com/product.jpg',
      };
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: imageMsg,
        },
        status: 201,
      } as any);

      const request: SendMessageRequest = {
        content: null,
        imageUrl: 'https://example.com/product.jpg',
      };

      const result = await sendMessage('conv-1111-2222', request, 'key-image');

      expect(result.imageUrl).toBe('https://example.com/product.jpg');
    });

    it('requires a mandatory non-empty Idempotency-Key and throws if empty or whitespace', async () => {
      await expect(
        sendMessage('conv-1111-2222', { content: 'Hello' }, ''),
      ).rejects.toThrow('sendMessage requires an explicit, non-empty idempotencyKey');

      await expect(
        sendMessage('conv-1111-2222', { content: 'Hello' }, '   '),
      ).rejects.toThrow('sendMessage requires an explicit, non-empty idempotencyKey');

      expect(mockedClient.post).not.toHaveBeenCalled();
    });

    it('propagates ApiError on validation failure (400 VALIDATION_ERROR)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A message needs content or an imageUrl',
          },
        },
        status: 400,
      } as any);

      await expect(
        sendMessage('conv-1111-2222', { content: '' }, 'key-empty'),
      ).rejects.toThrow(ApiError);
    });
  });

  describe('markConversationRead', () => {
    it('calls PATCH /conversations/{id}/read and unwraps void response', async () => {
      mockedClient.patch.mockResolvedValueOnce({
        data: {
          success: true,
          data: null,
        },
        status: 200,
      } as any);

      await markConversationRead('conv-1111-2222');

      expect(mockedClient.patch).toHaveBeenCalledWith('/conversations/conv-1111-2222/read');
    });

    it('encodes URI component for conversationId in URL path', async () => {
      mockedClient.patch.mockResolvedValueOnce({
        data: {
          success: true,
          data: null,
        },
        status: 200,
      } as any);

      await markConversationRead('conv/slash/read');

      expect(mockedClient.patch).toHaveBeenCalledWith('/conversations/conv%2Fslash%2Fread/read');
    });

    it('propagates ApiError on non-participant 404 RESOURCE_NOT_FOUND', async () => {
      mockedClient.patch.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Conversation not found',
          },
        },
        status: 404,
      } as any);

      await expect(markConversationRead('missing-conv')).rejects.toThrow(ApiError);
    });
  });

  describe('backend contract shape integrity', () => {
    it('ensures ConversationResponse has exactly backend fields and no fabricated fields', () => {
      const keys = Object.keys(mockConversation).sort();
      expect(keys).toEqual([
        'createdAt',
        'customerId',
        'id',
        'lastMessageAt',
        'orderId',
        'productId',
        'sellerId',
      ]);
      expect((mockConversation as any).updatedAt).toBeUndefined();
    });

    it('ensures MessageResponse matches backend DTO (isRead, imageUrl, no recipientId, no readAt)', () => {
      const keys = Object.keys(mockMessage).sort();
      expect(keys).toEqual([
        'content',
        'conversationId',
        'createdAt',
        'id',
        'imageUrl',
        'isRead',
        'senderId',
      ]);
      expect((mockMessage as any).recipientId).toBeUndefined();
      expect((mockMessage as any).readAt).toBeUndefined();
    });

    it('ensures PageResponse matches backend PageResponse.java without first or last', () => {
      const keys = Object.keys(mockPageResponse).sort();
      expect(keys).toEqual(['content', 'page', 'size', 'totalElements', 'totalPages']);
      expect((mockPageResponse as any).first).toBeUndefined();
      expect((mockPageResponse as any).last).toBeUndefined();
    });
  });
});
