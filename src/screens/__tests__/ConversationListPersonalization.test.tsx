import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ConversationListScreen from '../ConversationListScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { useConversations } from '../../hooks/useChat';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';
import type { ConversationResponse } from '../../types/chatApi';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useChat');
jest.mock('../../hooks/useChatWebSocket');
jest.mock('../../hooks/useSellers', () => ({
  useSellerShop: jest.fn().mockReturnValue({ data: undefined, isLoading: false }),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseConversations = useConversations as jest.MockedFunction<typeof useConversations>;
const mockedUseChatWebSocket = useChatWebSocket as jest.MockedFunction<typeof useChatWebSocket>;

function renderConversationListScreen(
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light',
  userRole: 'CUSTOMER' | 'SELLER' | 'GUEST' = 'CUSTOMER',
  conversations: ConversationResponse[] = []
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
  };

  if (userRole === 'GUEST') {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    } as any);
  } else {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: userRole,
      },
      isAuthenticated: true,
    } as any);
  }

  mockedUseConversations.mockReturnValue({
    data: conversations,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  } as any);

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <ConversationListScreen navigation={mockNavigation} route={{} as any} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('ConversationListScreen UI Personalization (Theme & i18n)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseChatWebSocket.mockReturnValue({
      connectionState: 'connected',
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });
  });

  it('renders correctly in Vietnamese with localized customer empty state', () => {
    const { getByText } = renderConversationListScreen('vi', 'light', 'CUSTOMER', []);

    expect(getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy();
    expect(getByText('Tin nhắn giữa bạn và các shop sẽ xuất hiện ở đây.')).toBeTruthy();
    expect(getByText('Làm mới')).toBeTruthy();
  });

  it('renders correctly in English with localized customer empty state', () => {
    const { getByText } = renderConversationListScreen('en', 'light', 'CUSTOMER', []);

    expect(getByText('No conversations yet')).toBeTruthy();
    expect(getByText('Messages between you and shops will appear here.')).toBeTruthy();
    expect(getByText('Refresh')).toBeTruthy();
  });

  it('renders correctly in English with localized seller empty state', () => {
    const { getByText } = renderConversationListScreen('en', 'light', 'SELLER', []);

    expect(getByText('No messages from customers yet')).toBeTruthy();
    expect(getByText('Conversations from customers will appear here.')).toBeTruthy();
    expect(getByText('Refresh')).toBeTruthy();
  });

  it('renders correctly in English with localized guest login required notice', () => {
    const { getByText, getAllByText } = renderConversationListScreen('en', 'light', 'GUEST', []);

    expect(getByText('Sign-in required')).toBeTruthy();
    expect(
      getByText('You need to sign in with a Buyer or Seller account to view messages.')
    ).toBeTruthy();
    expect(getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
  });

  it('renders correctly in Dark Mode with dark theme background', () => {
    const { getByTestId, getByText } = renderConversationListScreen('vi', 'dark', 'CUSTOMER', []);

    const container = getByTestId('conversation-list-screen');
    const containerStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(containerStyle.backgroundColor).toBe('#121212');
    expect(getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy();
  });
});
