import React from 'react';
import { Pressable, Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AiAssistantScreen from '../AiAssistantScreen';
import { AppThemeProvider } from '../../theme';
import { AppI18nProvider, useAppLanguage } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { useAiSessionMessages, useAiSessions, useAskAi } from '../../hooks/useAi';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useAi');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAskAi = useAskAi as jest.MockedFunction<typeof useAskAi>;
const mockedUseAiSessions = useAiSessions as jest.MockedFunction<typeof useAiSessions>;
const mockedUseAiSessionMessages = useAiSessionMessages as jest.MockedFunction<
  typeof useAiSessionMessages
>;

const mockMutateAsync = jest.fn();

function renderAiAssistantScreen(
  language: 'vi' | 'en' = 'vi',
  preference: 'light' | 'dark' = 'light',
  userRole: 'CUSTOMER' | 'SELLER' | 'ADMIN' | 'GUEST' = 'CUSTOMER'
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  };

  const mockRoute: any = {
    key: 'AiAssistant-test',
    name: 'AiAssistant',
    params: {},
  };

  if (userRole === 'GUEST') {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
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
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    } as any);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider initialPreference={preference}>
        <AppI18nProvider initialLanguage={language}>
          <AiAssistantScreen navigation={mockNavigation} route={mockRoute} />
        </AppI18nProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

describe('AiAssistantScreen UI Personalization (Theme & i18n)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockMutateAsync.mockResolvedValue({
      answer: 'Mock response',
      query: null,
      products: [],
      sessionId: 'session-123',
      answeredBy: 'AI',
    });

    mockedUseAskAi.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    mockedUseAiSessions.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    mockedUseAiSessionMessages.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as any);
  });

  it('renders correctly in Vietnamese with localized welcome greeting, suggested prompts, and actions', () => {
    const { getByText, getByPlaceholderText } = renderAiAssistantScreen('vi', 'light', 'CUSTOMER');

    // Welcome greeting in Vietnamese
    expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();
    expect(getByText('Bạn muốn tìm sản phẩm hoặc hỏi gì về cửa hàng?')).toBeTruthy();
    expect(getByText('Gợi ý câu hỏi:')).toBeTruthy();

    // Suggested prompts in Vietnamese
    expect(getByText('Tìm tai nghe chống ồn dưới 2 triệu')).toBeTruthy();
    expect(getByText('Gợi ý laptop có đánh giá tốt')).toBeTruthy();
    expect(getByText('Có những hình thức thanh toán nào?')).toBeTruthy();
    expect(getByText('Chính sách hủy đơn như thế nào?')).toBeTruthy();

    // Top actions
    expect(getByText('Lịch sử')).toBeTruthy();
    expect(getByText('Đoạn chat mới')).toBeTruthy();

    // Composer placeholder
    expect(getByPlaceholderText('Hỏi về sản phẩm, chính sách...')).toBeTruthy();
  });

  it('renders correctly in English with localized welcome greeting, suggested prompts, and actions', () => {
    const { getByText, getByPlaceholderText } = renderAiAssistantScreen('en', 'light', 'CUSTOMER');

    // Welcome greeting in English
    expect(getByText('Hello! I am your AI shopping assistant.')).toBeTruthy();
    expect(
      getByText('What product are you looking for or what would you like to know about our store?')
    ).toBeTruthy();
    expect(getByText('Suggested questions:')).toBeTruthy();

    // Suggested prompts in English
    expect(getByText('Find noise-cancelling headphones under 2 million')).toBeTruthy();
    expect(getByText('Suggest highly rated laptops')).toBeTruthy();
    expect(getByText('What payment methods are available?')).toBeTruthy();
    expect(getByText('What is the order cancellation policy?')).toBeTruthy();

    // Top actions
    expect(getByText('History')).toBeTruthy();
    expect(getByText('New Chat')).toBeTruthy();

    // Composer placeholder
    expect(getByPlaceholderText('Ask about products, policies...')).toBeTruthy();
  });

  it('renders correctly in Dark Mode with dark theme background and surface colors', () => {
    const { getByTestId, getByText } = renderAiAssistantScreen('vi', 'dark', 'CUSTOMER');

    const screenContainer = getByTestId('ai-assistant-screen');
    const containerStyle = Array.isArray(screenContainer.props.style)
      ? Object.assign({}, ...screenContainer.props.style)
      : screenContainer.props.style;
    expect(containerStyle.backgroundColor).toBe('#121212');

    // Content still renders correctly in dark mode
    expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();
  });

  it('renders localized blocked state when accessed by SELLER in English', () => {
    const { getByText } = renderAiAssistantScreen('en', 'light', 'SELLER');

    expect(getByText('AI Shopping Assistant')).toBeTruthy();
    expect(
      getByText(
        'AI Assistant is only available for Customers and Guests to search products and ask about policies.'
      )
    ).toBeTruthy();
    expect(getByText('Go Back')).toBeTruthy();
  });

  it('injects English response instruction into askAi payload when app language is en, while visible user bubble contains only raw question', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      answer: 'This is the English answer from AI.',
      query: null,
      products: [],
      sessionId: 'session-en-1',
      answeredBy: 'AI',
    });

    const { getByLabelText, getByRole, getByText, queryByText } = renderAiAssistantScreen('en', 'light', 'CUSTOMER');

    const input = getByLabelText('Type question for AI assistant');
    const sendButton = getByRole('button', { name: 'Send question' });

    fireEvent.changeText(input, 'What are the top rated headphones?');
    fireEvent.press(sendButton);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      message: 'Please answer in English.\n\nWhat are the top rated headphones?',
    });

    await waitFor(() => {
      // Visible user bubble has ONLY the raw user question
      expect(getByText('What are the top rated headphones?')).toBeTruthy();
      // Outgoing prompt prefix is NEVER rendered in the chat UI
      expect(queryByText(/Please answer in English\./)).toBeNull();
      // AI response is rendered verbatim
      expect(getByText('This is the English answer from AI.')).toBeTruthy();
    });
  });

  it('injects Vietnamese response instruction into askAi payload when app language is vi, while visible user bubble contains only raw question', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      answer: 'Đây là câu trả lời tiếng Việt từ AI.',
      query: null,
      products: [],
      sessionId: 'session-vi-1',
      answeredBy: 'AI',
    });

    const { getByLabelText, getByRole, getByText, queryByText } = renderAiAssistantScreen('vi', 'light', 'CUSTOMER');

    const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
    const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

    fireEvent.changeText(input, 'Tai nghe nào chống ồn tốt nhất?');
    fireEvent.press(sendButton);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      message: 'Vui lòng trả lời bằng tiếng Việt.\n\nTai nghe nào chống ồn tốt nhất?',
    });

    await waitFor(() => {
      // Visible user bubble has ONLY the raw user question
      expect(getByText('Tai nghe nào chống ồn tốt nhất?')).toBeTruthy();
      // Outgoing prompt prefix is NEVER rendered in the chat UI
      expect(queryByText(/Vui lòng trả lời bằng tiếng Việt\./)).toBeNull();
      // AI response is rendered verbatim
      expect(getByText('Đây là câu trả lời tiếng Việt từ AI.')).toBeTruthy();
    });
  });

  it('renders backend response verbatim without client-side translation or mutation', async () => {
    const verbatimAnswer = 'Verbatim response containing exact symbols: 100% #1 & Special Text!';
    mockMutateAsync.mockResolvedValueOnce({
      answer: verbatimAnswer,
      query: null,
      products: [],
      sessionId: 'session-verbatim',
      answeredBy: 'AI',
    });

    const { getByLabelText, getByRole, getByText } = renderAiAssistantScreen('vi', 'light', 'CUSTOMER');

    const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
    const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

    fireEvent.changeText(input, 'Kiểm tra');
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(getByText(verbatimAnswer)).toBeTruthy();
    });
  });

  it('dynamically adapts prompt instruction at send-time when language is changed', async () => {
    mockMutateAsync
      .mockResolvedValueOnce({
        answer: 'Câu trả lời 1',
        query: null,
        products: [],
        sessionId: 'sess-dyn',
        answeredBy: 'AI',
      })
      .mockResolvedValueOnce({
        answer: 'Answer 2',
        query: null,
        products: [],
        sessionId: 'sess-dyn',
        answeredBy: 'AI',
      });

    const mockNavigation: any = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => true,
    };

    const mockRoute: any = {
      key: 'AiAssistant-test',
      name: 'AiAssistant',
      params: {},
    };

    function TestApp() {
      const { language, setLanguage } = useAppLanguage();
      return (
        <>
          <Pressable
            testID="toggle-lang-btn"
            onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
          >
            <Text>Toggle Lang</Text>
          </Pressable>
          <AiAssistantScreen navigation={mockNavigation} route={mockRoute} />
        </>
      );
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId, getByLabelText, getByRole, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider initialPreference="light">
          <AppI18nProvider initialLanguage="vi">
            <TestApp />
          </AppI18nProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    );

    // Send first question in Vietnamese
    fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Câu hỏi tiếng Việt');
    fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      message: 'Vui lòng trả lời bằng tiếng Việt.\n\nCâu hỏi tiếng Việt',
    });

    await waitFor(() => {
      expect(getByText('Câu trả lời 1')).toBeTruthy();
    });

    // Toggle language to English
    fireEvent.press(getByTestId('toggle-lang-btn'));

    // Send second question in English
    fireEvent.changeText(getByLabelText('Type question for AI assistant'), 'English question');
    fireEvent.press(getByRole('button', { name: 'Send question' }));

    expect(mockMutateAsync).toHaveBeenLastCalledWith({
      message: 'Please answer in English.\n\nEnglish question',
      sessionId: 'sess-dyn',
    });
  });
});
