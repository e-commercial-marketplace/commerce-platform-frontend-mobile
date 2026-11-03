import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ChatRoomScreen from '../ChatRoomScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationRead,
  useSendMessage,
} from '../../hooks/useChat';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';
import { useSellerShop } from '../../hooks/useSellers';
import type { MessageResponse, PageResponse } from '../../types/chatApi';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useChat');
jest.mock('../../hooks/useChatWebSocket');
jest.mock('../../hooks/useSellers');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseConversationMessages = useConversationMessages as jest.MockedFunction<
  typeof useConversationMessages
>;
const mockedUseConversations = useConversations as jest.MockedFunction<typeof useConversations>;
const mockedUseSendMessage = useSendMessage as jest.MockedFunction<typeof useSendMessage>;
const mockedUseMarkConversationRead = useMarkConversationRead as jest.MockedFunction<
  typeof useMarkConversationRead
>;
const mockedUseChatWebSocket = useChatWebSocket as jest.MockedFunction<typeof useChatWebSocket>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

const mockReadMessage: MessageResponse = {
  id: 'msg-read-1',
  conversationId: 'conv-123',
  senderId: 'user-sender',
  content: 'Sản phẩm này còn màu đen không shop?',
  imageUrl: null,
  isRead: true,
  createdAt: '2026-10-30T10:00:00Z',
};

function renderChatRoomScreen(
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light',
  connectionState: 'connected' | 'reconnecting' | 'disconnected' = 'connected',
  messages: MessageResponse[] = []
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };

  const mockRoute: any = {
    key: 'ChatRoom-test',
    name: 'ChatRoom',
    params: {
      conversationId: 'conv-123',
      counterpartName: 'Tech Store Official',
    },
  };

  mockedUseAuth.mockReturnValue({
    user: {
      id: 'user-sender',
      email: 'user@example.com',
      name: 'Test Customer',
      role: 'CUSTOMER',
    },
    isAuthenticated: true,
  } as any);

  mockedUseChatWebSocket.mockReturnValue({
    connectionState,
    reconnect: jest.fn(),
    disconnect: jest.fn(),
  });

  mockedUseConversations.mockReturnValue({
    data: [
      {
        id: 'conv-123',
        customerId: 'user-sender',
        sellerId: 'seller-456',
        productId: null,
        orderId: null,
        createdAt: '2026-10-30T09:00:00Z',
        lastMessageAt: '2026-10-30T10:00:00Z',
      },
    ],
  } as any);

  mockedUseSellerShop.mockReturnValue({
    data: { id: 'seller-456', name: 'Tech Store Official' },
  } as any);

  const pageResponse: PageResponse<MessageResponse> = {
    content: messages,
    page: 0,
    size: 20,
    totalElements: messages.length,
    totalPages: 1,
  };

  mockedUseConversationMessages.mockReturnValue({
    data: {
      pages: [pageResponse],
      pageParams: [0],
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  } as any);

  mockedUseSendMessage.mockReturnValue({
    mutateAsync: jest.fn(),
    isPending: false,
  } as any);

  mockedUseMarkConversationRead.mockReturnValue({
    mutate: jest.fn(),
  } as any);

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <ChatRoomScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('ChatRoomScreen UI Personalization (Theme & i18n)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly in Vietnamese with localized composer placeholder, read status, and user content unchanged', () => {
    const { getByText, getByPlaceholderText } = renderChatRoomScreen(
      'vi',
      'light',
      'connected',
      [mockReadMessage]
    );

    // Composer placeholder in Vietnamese
    expect(getByPlaceholderText('Nhập tin nhắn...')).toBeTruthy();

    // Read indicator in Vietnamese
    expect(getByText('Đã xem')).toBeTruthy();

    // Invariant user message text must NOT be translated
    expect(getByText('Sản phẩm này còn màu đen không shop?')).toBeTruthy();
  });

  it('renders correctly in English with localized composer placeholder, read status, and user content unchanged', () => {
    const { getByText, getByPlaceholderText } = renderChatRoomScreen(
      'en',
      'light',
      'connected',
      [mockReadMessage]
    );

    // Composer placeholder in English
    expect(getByPlaceholderText('Type a message...')).toBeTruthy();

    // Read indicator in English
    expect(getByText('Seen')).toBeTruthy();

    // Invariant user message text must NOT be translated
    expect(getByText('Sản phẩm này còn màu đen không shop?')).toBeTruthy();
  });

  it('renders localized real-time connection banners in English', () => {
    const { getByText: getByTextReconnecting } = renderChatRoomScreen(
      'en',
      'light',
      'reconnecting',
      []
    );
    expect(getByTextReconnecting('Reconnecting real-time chat…')).toBeTruthy();

    const { getByText: getByTextDisconnected } = renderChatRoomScreen(
      'en',
      'light',
      'disconnected',
      []
    );
    expect(getByTextDisconnected('Real-time chat disconnected')).toBeTruthy();
    expect(getByTextDisconnected('Reconnect')).toBeTruthy();
  });

  it('renders correctly in Dark Mode with dark theme background', () => {
    const { getByTestId, getByText } = renderChatRoomScreen(
      'vi',
      'dark',
      'connected',
      [mockReadMessage]
    );

    const container = getByTestId('chat-room-screen');
    const containerStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(containerStyle.backgroundColor).toBe('#121212');

    expect(getByText('Sản phẩm này còn màu đen không shop?')).toBeTruthy();
  });
});
