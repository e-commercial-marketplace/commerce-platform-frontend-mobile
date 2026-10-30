/**
 * Unit tests for AI Assistant TanStack Query hooks.
 */

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import type {
  AiAskRequest,
  AiChatSessionResponse,
  AiMessageResponse,
  AiProductSearchResponse,
} from '../../types/aiApi';
import { askAi, getAiSessionMessages, getAiSessions } from '../../services/aiService';
import { useAiSessionMessages, useAiSessions, useAskAi } from '../useAi';

jest.mock('../../services/aiService', () => ({
  askAi: jest.fn(),
  getAiSessions: jest.fn(),
  getAiSessionMessages: jest.fn(),
}));

const mockedAskAi = askAi as jest.MockedFunction<typeof askAi>;
const mockedGetAiSessions = getAiSessions as jest.MockedFunction<typeof getAiSessions>;
const mockedGetAiSessionMessages = getAiSessionMessages as jest.MockedFunction<
  typeof getAiSessionMessages
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

const mockAiResponse: AiProductSearchResponse = {
  answer: 'Dưới đây là các gợi ý sản phẩm phù hợp:',
  query: {
    text: 'laptop',
    category: 'Máy tính',
    minPrice: null,
    maxPrice: '15000000.00',
    minRating: null,
    sort: 'price_asc',
  },
  products: [
    {
      id: 'prod-1',
      name: 'Laptop Văn Phòng 14 inch',
      imageUrl: null,
      price: '12500000.00',
      stock: 5,
      ratingAverage: '4.50',
      reviewCount: 12,
      sellerId: 'seller-1',
    },
  ],
  sessionId: 'session-1',
  answeredBy: 'AI',
};

const mockRulesResponse: AiProductSearchResponse = {
  answer: 'Chính sách hoàn tiền của marketplace theo quy định sau...',
  query: null,
  products: [],
  sessionId: 'session-1',
  answeredBy: 'RULES',
};

const mockSessions: AiChatSessionResponse[] = [
  {
    id: 'session-1',
    userId: 'user-1',
    createdAt: '2026-10-30T08:00:00Z',
  },
];

const mockMessages: AiMessageResponse[] = [
  {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'USER',
    content: 'Chính sách hoàn tiền?',
    confidence: null,
    createdAt: '2026-10-30T08:00:00Z',
  },
  {
    id: 'msg-2',
    sessionId: 'session-1',
    role: 'ASSISTANT',
    content: 'Chính sách hoàn tiền của marketplace...',
    confidence: null,
    createdAt: '2026-10-30T08:00:02Z',
  },
];

describe('useAskAi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls askAi service with exact request and exposes success data', async () => {
    mockedAskAi.mockResolvedValueOnce(mockAiResponse);

    const client = makeClient();
    const { result } = renderHook(() => useAskAi(), { wrapper: wrapper(client) });

    const request: AiAskRequest = {
      message: 'Tìm laptop dưới 15 triệu',
      sessionId: 'session-1',
    };

    let data: AiProductSearchResponse | undefined;
    await waitFor(async () => {
      data = await result.current.mutateAsync(request);
    });

    expect(mockedAskAi).toHaveBeenCalledWith(request);
    expect(data).toEqual(mockAiResponse);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(mockAiResponse);
    expect(result.current.data?.answeredBy).toBe('AI');
  });

  it('treats RULES response as successful response, NOT an error', async () => {
    mockedAskAi.mockResolvedValueOnce(mockRulesResponse);

    const client = makeClient();
    const { result } = renderHook(() => useAskAi(), { wrapper: wrapper(client) });

    const request: AiAskRequest = {
      message: 'Chính sách hoàn tiền?',
    };

    let data: AiProductSearchResponse | undefined;
    await waitFor(async () => {
      data = await result.current.mutateAsync(request);
    });

    expect(mockedAskAi).toHaveBeenCalledWith(request);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(data?.answeredBy).toBe('RULES');
    expect(data?.answer).toContain('Chính sách hoàn tiền');
  });
});

describe('useAiSessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses correct query key and fetches when enabled', async () => {
    mockedGetAiSessions.mockResolvedValueOnce(mockSessions);

    const client = makeClient();
    const { result } = renderHook(() => useAiSessions(true), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetAiSessions).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockSessions);
    expect(client.getQueryData(queryKeys.ai.sessions())).toEqual(mockSessions);
  });

  it('supports options object with enabled: true', async () => {
    mockedGetAiSessions.mockResolvedValueOnce(mockSessions);

    const client = makeClient();
    const { result } = renderHook(() => useAiSessions({ enabled: true }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetAiSessions).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockSessions);
  });

  it('does not fetch when disabled (e.g. for guest or non-customer)', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useAiSessions(false), { wrapper: wrapper(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetAiSessions).not.toHaveBeenCalled();
  });
});

describe('useAiSessionMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches messages for valid session ID when enabled', async () => {
    mockedGetAiSessionMessages.mockResolvedValueOnce(mockMessages);

    const client = makeClient();
    const { result } = renderHook(() => useAiSessionMessages('session-1', true), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGetAiSessionMessages).toHaveBeenCalledWith('session-1');
    expect(result.current.data).toEqual(mockMessages);
    expect(client.getQueryData(queryKeys.ai.sessionMessages('session-1'))).toEqual(mockMessages);
  });

  it('does not fetch without session ID (undefined, null, or empty string)', () => {
    const client = makeClient();

    const { result: resUndefined } = renderHook(() => useAiSessionMessages(undefined, true), {
      wrapper: wrapper(client),
    });
    expect(resUndefined.current.fetchStatus).toBe('idle');

    const { result: resNull } = renderHook(() => useAiSessionMessages(null, true), {
      wrapper: wrapper(client),
    });
    expect(resNull.current.fetchStatus).toBe('idle');

    const { result: resEmpty } = renderHook(() => useAiSessionMessages('   ', true), {
      wrapper: wrapper(client),
    });
    expect(resEmpty.current.fetchStatus).toBe('idle');

    expect(mockedGetAiSessionMessages).not.toHaveBeenCalled();
  });

  it('does not fetch when explicitly disabled even with valid session ID', () => {
    const client = makeClient();
    const { result } = renderHook(() => useAiSessionMessages('session-1', false), {
      wrapper: wrapper(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetAiSessionMessages).not.toHaveBeenCalled();
  });
});
