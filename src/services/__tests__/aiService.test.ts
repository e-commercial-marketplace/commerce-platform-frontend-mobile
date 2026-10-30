/**
 * Unit tests for AI Assistant API service.
 */

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type {
  AiAskRequest,
  AiChatSessionResponse,
  AiMessageResponse,
  AiProductSearchResponse,
} from '../../types/aiApi';
import { askAi, getAiSessionMessages, getAiSessions } from '../aiService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const mockAiResponse: AiProductSearchResponse = {
  answer: 'Mình tìm thấy 1 mẫu tai nghe phù hợp với bạn.',
  query: {
    text: 'tai nghe',
    category: 'Tai nghe & Loa',
    minPrice: null,
    maxPrice: '2000000.00',
    minRating: '4.00',
    sort: 'price_asc',
  },
  products: [
    {
      id: 'prod-uuid-1',
      name: 'Tai nghe không dây chống ồn',
      imageUrl: 'https://example.com/item.jpg',
      price: '1890000.00',
      stock: 15,
      ratingAverage: '4.80',
      reviewCount: 30,
      sellerId: 'seller-uuid-1',
    },
  ],
  sessionId: 'session-uuid-123',
  answeredBy: 'AI',
};

const mockRulesResponse: AiProductSearchResponse = {
  answer: 'Marketplace hỗ trợ 2 hình thức thanh toán: COD và VNPAY.',
  query: null,
  products: [],
  sessionId: 'session-uuid-123',
  answeredBy: 'RULES',
};

const mockGuestResponse: AiProductSearchResponse = {
  answer: 'Chào bạn! Mình có thể giúp gì cho bạn?',
  query: null,
  products: [],
  sessionId: null,
  answeredBy: 'AI',
};

const mockSessions: AiChatSessionResponse[] = [
  {
    id: 'session-uuid-1',
    userId: 'user-uuid-1',
    createdAt: '2026-10-30T08:00:00Z',
  },
  {
    id: 'session-uuid-2',
    userId: 'user-uuid-1',
    createdAt: '2026-10-29T12:00:00Z',
  },
];

const mockMessages: AiMessageResponse[] = [
  {
    id: 'msg-1',
    sessionId: 'session-uuid-1',
    role: 'USER',
    content: 'Tìm tai nghe dưới 2 triệu',
    confidence: null,
    createdAt: '2026-10-30T08:00:01Z',
  },
  {
    id: 'msg-2',
    sessionId: 'session-uuid-1',
    role: 'ASSISTANT',
    content: 'Mình tìm thấy 1 mẫu tai nghe...',
    confidence: null,
    createdAt: '2026-10-30T08:00:03Z',
  },
];

describe('aiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('askAi', () => {
    it('POSTs to /ai/ask with correct message body and sessionId when supplied', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockAiResponse,
        },
        status: 200,
      } as any);

      const request: AiAskRequest = {
        message: 'Tìm tai nghe dưới 2 triệu',
        sessionId: 'session-uuid-123',
      };

      const result = await askAi(request);

      expect(mockedClient.post).toHaveBeenCalledWith('/ai/ask', request);
      expect(result).toEqual(mockAiResponse);
      expect(result.sessionId).toBe('session-uuid-123');
      expect(result.answeredBy).toBe('AI');
    });

    it('supports request without sessionId (new customer session or guest)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockAiResponse,
        },
        status: 200,
      } as any);

      const request: AiAskRequest = {
        message: 'Tìm tai nghe',
      };

      const result = await askAi(request);

      expect(mockedClient.post).toHaveBeenCalledWith('/ai/ask', request);
      expect(result).toEqual(mockAiResponse);
    });

    it('preserves decimal STRING values in price, rating, minPrice, maxPrice, minRating', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockAiResponse,
        },
        status: 200,
      } as any);

      const result = await askAi({ message: 'Tìm tai nghe' });

      expect(typeof result.products[0].price).toBe('string');
      expect(result.products[0].price).toBe('1890000.00');
      expect(typeof result.products[0].ratingAverage).toBe('string');
      expect(result.products[0].ratingAverage).toBe('4.80');
      expect(typeof result.query?.maxPrice).toBe('string');
      expect(result.query?.maxPrice).toBe('2000000.00');
      expect(typeof result.query?.minRating).toBe('string');
      expect(result.query?.minRating).toBe('4.00');
    });

    it('preserves products: [] and sessionId: null for guest responses', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockGuestResponse,
        },
        status: 200,
      } as any);

      const result = await askAi({ message: 'Xin chào', sessionId: null });

      expect(result.products).toEqual([]);
      expect(result.sessionId).toBeNull();
      expect(result.query).toBeNull();
      expect(result.answeredBy).toBe('AI');
    });

    it('preserves answeredBy: RULES for rule-based fallback responses', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockRulesResponse,
        },
        status: 200,
      } as any);

      const result = await askAi({ message: 'Thanh toán thế nào' });

      expect(result.answeredBy).toBe('RULES');
      expect(result.answer).toContain('VNPAY');
      expect(result.products).toEqual([]);
    });

    it('propagates ApiError on validation failure (400 Bad Request)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'message must not be blank',
            fieldErrors: { message: 'must not be blank' },
          },
        },
        status: 400,
      } as any);

      await expect(askAi({ message: '   ' })).rejects.toThrow(ApiError);
    });

    it('propagates ApiError on rate limiting (429 RATE_LIMITED)', async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many AI questions, try again in a minute',
          },
        },
        status: 429,
      } as any);

      await expect(askAi({ message: 'test' })).rejects.toThrow(ApiError);
    });
  });

  describe('getAiSessions', () => {
    it('calls GET /ai/sessions and unwraps session list', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockSessions,
        },
        status: 200,
      } as any);

      const result = await getAiSessions();

      expect(mockedClient.get).toHaveBeenCalledWith('/ai/sessions');
      expect(result).toEqual(mockSessions);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-uuid-1');
    });

    it('propagates ApiError on unauthorized (401)', async () => {
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

      await expect(getAiSessions()).rejects.toThrow(ApiError);
    });
  });

  describe('getAiSessionMessages', () => {
    it('calls GET /ai/sessions/{sessionId}/messages with encoded URL and unwraps messages', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockMessages,
        },
        status: 200,
      } as any);

      const result = await getAiSessionMessages('session-uuid-1');

      expect(mockedClient.get).toHaveBeenCalledWith('/ai/sessions/session-uuid-1/messages');
      expect(result).toEqual(mockMessages);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('USER');
      expect(result[1].role).toBe('ASSISTANT');
    });

    it('encodes special characters in sessionId in URL path', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: [],
        },
        status: 200,
      } as any);

      await getAiSessionMessages('session/with/slashes');

      expect(mockedClient.get).toHaveBeenCalledWith(
        '/ai/sessions/session%2Fwith%2Fslashes/messages',
      );
    });

    it('propagates ApiError on session not found (404)', async () => {
      mockedClient.get.mockResolvedValueOnce({
        data: {
          success: false,
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'AI session not found: missing-id',
          },
        },
        status: 404,
      } as any);

      await expect(getAiSessionMessages('missing-id')).rejects.toThrow(ApiError);
    });
  });
});
