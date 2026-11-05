/**
 * Integration and UI tests for AiAssistantScreen (Phases 2–4).
 */

import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import * as productService from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { useAiSessionMessages, useAiSessions, useAskAi } from '../../hooks/useAi';
import type { AiChatSessionResponse, AiMessageResponse, AiProductSearchResponse } from '../../types/aiApi';
import type { User } from '../../types/auth';
import AiAssistantScreen from '../AiAssistantScreen';

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      fetchQuery: jest.fn(),
      setQueryData: jest.fn(),
      getQueryData: jest.fn(),
    }),
  };
});

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useAi');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAskAi = useAskAi as jest.MockedFunction<typeof useAskAi>;
const mockedUseAiSessions = useAiSessions as jest.MockedFunction<typeof useAiSessions>;
const mockedUseAiSessionMessages = useAiSessionMessages as jest.MockedFunction<typeof useAiSessionMessages>;

const CUSTOMER_USER: User = {
  id: 'cust-1',
  email: 'customer@example.com',
  name: 'Test Customer',
  role: 'CUSTOMER',
};

const SELLER_USER: User = {
  id: 'seller-1',
  email: 'seller@example.com',
  name: 'Test Seller',
  role: 'SELLER',
};

const ADMIN_USER: User = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Test Admin',
  role: 'ADMIN',
};

const mockAiResponse: AiProductSearchResponse = {
  answer: 'I found 2 headphone models for you.',
  query: null,
  products: [
    {
      id: 'p-1',
      name: 'Sony Noise-Cancelling Headphones',
      imageUrl: 'https://example.com/sony.jpg',
      price: '1990000.00',
      stock: 10,
      ratingAverage: '4.80',
      reviewCount: 45,
      sellerId: 's-1',
    },
  ],
  sessionId: 'session-cust-123',
  answeredBy: 'AI',
};

const mockRulesResponse: AiProductSearchResponse = {
  answer: 'The marketplace has 2 payment methods: COD and VNPAY.',
  query: null,
  products: [],
  sessionId: 'session-cust-123',
  answeredBy: 'RULES',
};

const mockRulesResponseWithProducts: AiProductSearchResponse = {
  answer: 'Product suggestions based on rules:',
  query: null,
  products: [
    {
      id: 'p-rules-1',
      name: 'JBL Noise-Cancelling Headphones',
      imageUrl: null,
      price: '890000.00',
      stock: 3,
      ratingAverage: '4.40',
      reviewCount: 15,
      sellerId: 's-2',
    },
  ],
  sessionId: 'session-cust-123',
  answeredBy: 'RULES',
};

const mockSessionsList: AiChatSessionResponse[] = [
  {
    id: 'session-history-1',
    userId: 'cust-1',
    createdAt: '2026-10-30T08:30:00.000Z',
  },
  {
    id: 'session-history-2',
    userId: 'cust-1',
    createdAt: '2026-10-29T10:00:00.000Z',
  },
];

const mockHistoricalMessages: AiMessageResponse[] = [
  {
    id: 'hist-msg-1',
    sessionId: 'session-history-1',
    role: 'USER',
    content: 'Do you have Sony headphones?',
    confidence: null,
    createdAt: '2026-10-30T08:30:10.000Z',
  },
  {
    id: 'hist-msg-2',
    sessionId: 'session-history-1',
    role: 'ASSISTANT',
    content: 'Yes, the store has several good noise-cancelling Sony headphones.',
    confidence: 0.95,
    createdAt: '2026-10-30T08:30:20.000Z',
  },
];

describe('AiAssistantScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockMutateAsync = jest.fn();

  const navigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    mockedUseAskAi.mockReturnValue({
      mutateAsync: mockMutateAsync,
      mutate: jest.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      error: null,
      data: undefined,
      reset: jest.fn(),
    } as any);

    mockedUseAiSessions.mockReturnValue({
      data: mockSessionsList,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseAiSessionMessages.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: jest.fn(),
    } as any);
  });

  describe('Empty state and suggestions', () => {
    it('renders empty state greeting and suggested prompts', () => {
      const { getByText, getByPlaceholderText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(getByText('Hello! I am your shopping assistant.')).toBeTruthy();
      expect(getByText('Do you want to find a product or ask something about the store?')).toBeTruthy();
      expect(getByText('Find noise-cancelling headphones under 2 million')).toBeTruthy();
      expect(getByText('Suggest well-rated laptops')).toBeTruthy();
      expect(getByText('What payment methods are available?')).toBeTruthy();
      expect(getByText('What is the order cancellation policy?')).toBeTruthy();
      expect(getByPlaceholderText('Ask about products, policies...')).toBeTruthy();
    });

    it('sends prompt immediately when tapping a suggested prompt', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.press(getByText('Find noise-cancelling headphones under 2 million'));

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nFind noise-cancelling headphones under 2 million',
      });

      await waitFor(() => {
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
      });
    });
  });

  describe('Composer validation and double-send prevention', () => {
    it('does not send when input is empty or whitespace only', () => {
      const { getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const sendButton = getByRole('button', { name: 'Send question' });
      fireEvent.press(sendButton);
      expect(mockMutateAsync).not.toHaveBeenCalled();

      const input = getByLabelText('Enter a question for the AI assistant');
      fireEvent.changeText(input, '    ');
      fireEvent.press(sendButton);
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('prevents rapid double-send from triggering multiple mutations', async () => {
      let resolvePromise: (val: any) => void = () => {};
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockMutateAsync.mockReturnValueOnce(pendingPromise);

      const { getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Enter a question for the AI assistant');
      const sendButton = getByRole('button', { name: 'Send question' });

      fireEvent.changeText(input, 'Find headphones');
      fireEvent.press(sendButton);
      fireEvent.press(sendButton); // Rapid second press

      expect(mockMutateAsync).toHaveBeenCalledTimes(1);

      resolvePromise(mockAiResponse);
    });
  });

  describe('Guest behavior', () => {
    it('sends guest request WITHOUT sessionId and renders assistant answer with AI indicator', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Guest must NOT see the history button
      expect(queryByText('History')).toBeNull();

      const input = getByLabelText('Enter a question for the AI assistant');
      const sendButton = getByRole('button', { name: 'Send question' });

      fireEvent.changeText(input, 'Find headphones');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nFind headphones',
      });

      await waitFor(() => {
        expect(getByText('Find headphones')).toBeTruthy();
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
        expect(getByText('AI')).toBeTruthy();
      });
    });

    it('renders RULES response as a successful answer with "Quick reply" tag', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'How to pay');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('The marketplace has 2 payment methods: COD and VNPAY.')).toBeTruthy();
        expect(getByText('Quick reply')).toBeTruthy();
      });
    });
  });

  describe('Authenticated Customer active session behavior', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: CUSTOMER_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
    });

    it('omits sessionId on first query, stores returned sessionId, and sends it on second query', async () => {
      mockMutateAsync
        .mockResolvedValueOnce(mockAiResponse) // first turn returns sessionId 'session-cust-123'
        .mockResolvedValueOnce({
          ...mockAiResponse,
          answer: 'The cheapest model is 1.990.000 ₫.',
        });

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Enter a question for the AI assistant');
      const sendButton = getByRole('button', { name: 'Send question' });

      // First query (omits sessionId)
      fireEvent.changeText(input, 'Find headphones');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nFind headphones',
      });

      await waitFor(() => {
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
      });

      // Second query (includes activeSessionId 'session-cust-123')
      fireEvent.changeText(input, 'Which one is the cheapest?');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nWhich one is the cheapest?',
        sessionId: 'session-cust-123',
      });

      await waitFor(() => {
        expect(getByText('The cheapest model is 1.990.000 ₫.')).toBeTruthy();
      });
    });
  });

  describe('Error handling', () => {
    it('displays friendly message on HTTP 429 rate limiting and keeps existing messages', async () => {
      mockMutateAsync.mockRejectedValueOnce(
        new ApiError('Rate limit exceeded', 'RATE_LIMITED', 429),
      );

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Ask many questions in a row');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Ask many questions in a row')).toBeTruthy(); // User message stays visible
        expect(
          getByText('You have asked too many questions in 1 minute. Please wait a moment and try again.'),
        ).toBeTruthy();
      });
    });

    it('displays friendly message on general network error and allows closing banner', async () => {
      mockMutateAsync.mockRejectedValueOnce(
        new ApiError('Network Error', 'NETWORK_ERROR', null),
      );

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Unstable network');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Could not connect to the assistant right now. Please try again.')).toBeTruthy();
      });

      // Close the error banner
      fireEvent.press(getByRole('button', { name: 'Close error notice' }));
      expect(queryByText('Could not connect to the assistant right now. Please try again.')).toBeNull();
    });

    it('resets activeSessionId on 404 RESOURCE_NOT_FOUND', async () => {
      mockedUseAuth.mockReturnValue({
        user: CUSTOMER_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      mockMutateAsync
        .mockResolvedValueOnce(mockAiResponse) // first call establishes sessionId
        .mockRejectedValueOnce(new ApiError('Session not found', 'RESOURCE_NOT_FOUND', 404)) // second call fails with 404
        .mockResolvedValueOnce(mockAiResponse); // third call should omit sessionId

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Enter a question for the AI assistant');
      const sendButton = getByRole('button', { name: 'Send question' });

      // Turn 1
      fireEvent.changeText(input, 'Turn 1');
      fireEvent.press(sendButton);
      await waitFor(() => expect(getByText('Turn 1')).toBeTruthy());

      // Turn 2: triggers 404
      fireEvent.changeText(input, 'Turn 2');
      fireEvent.press(sendButton);
      await waitFor(() => {
        expect(
          getByText(
            'The previous conversation session has ended. The next question will start a new conversation.',
          ),
        ).toBeTruthy();
      });

      // Turn 3: should omit sessionId because it was cleared
      fireEvent.changeText(input, 'Turn 3');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenLastCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nTurn 3',
      });
    });
  });

  describe('Role access restrictions', () => {
    it('blocks access for SELLER and does not call askAi', () => {
      mockedUseAuth.mockReturnValue({
        user: SELLER_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      const { getByText, queryByPlaceholderText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(
        getByText(
          'The AI assistant is only available to Customers and Guests for searching products and answering policy questions.',
        ),
      ).toBeTruthy();
      expect(queryByPlaceholderText('Ask about products, policies...')).toBeNull();
      expect(mockMutateAsync).not.toHaveBeenCalled();

      fireEvent.press(getByText('Go back'));
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('blocks access for ADMIN and does not call askAi', () => {
      mockedUseAuth.mockReturnValue({
        user: ADMIN_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      const { getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(
        getByText(
          'The AI assistant is only available to Customers and Guests for searching products and answering policy questions.',
        ),
      ).toBeTruthy();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Product recommendations and navigation (Phase 3)', () => {
    it('renders AiProductCard for assistant response containing products', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Find headphones');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Sony Noise-Cancelling Headphones')).toBeTruthy();
        expect(getByText('1.990.000 ₫')).toBeTruthy();
        expect(getByText('4.8')).toBeTruthy();
        expect(getByText('(45 reviews)')).toBeTruthy();
        expect(getByText('In stock')).toBeTruthy();
      });
    });

    it('does not render any AiProductCard when products array is empty', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponse);

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'How to pay?');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('The marketplace has 2 payment methods: COD and VNPAY.')).toBeTruthy();
      });

      expect(queryByText('Sony Noise-Cancelling Headphones')).toBeNull();
      expect(queryByText('In stock')).toBeNull();
      expect(queryByText('Out of stock')).toBeNull();
    });

    it('navigates to ProductDetail with productId when tapping a product card', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Find headphones');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Sony Noise-Cancelling Headphones')).toBeTruthy();
      });

      fireEvent.press(getByText('Sony Noise-Cancelling Headphones'));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p-1' });
    });

    it('renders product cards for RULES responses containing products and enables navigation', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponseWithProducts);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Find JBL headphones');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Product suggestions based on rules:')).toBeTruthy();
        expect(getByText('Quick reply')).toBeTruthy();
        expect(getByText('JBL Noise-Cancelling Headphones')).toBeTruthy();
        expect(getByText('890.000 ₫')).toBeTruthy();
        expect(getByText('3 left')).toBeTruthy();
      });

      fireEvent.press(getByText('JBL Noise-Cancelling Headphones'));
      expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p-rules-1' });
    });

    it('does not make any product detail API calls when rendering recommendation cards', async () => {
      const getProductByIdSpy = jest.spyOn(productService, 'getProductById');
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Find headphones');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Sony Noise-Cancelling Headphones')).toBeTruthy();
      });

      expect(getProductByIdSpy).not.toHaveBeenCalled();
      getProductByIdSpy.mockRestore();
    });
  });

  describe('Customer session history and conversation resume (Phase 4)', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: CUSTOMER_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
    });

    it('renders "History" button for CUSTOMER and opens drawer on tap', () => {
      const { getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(getByText('History')).toBeTruthy();
      expect(getByText('New chat')).toBeTruthy();

      // Open history drawer
      fireEvent.press(getByText('History'));

      expect(getByText('Conversation history')).toBeTruthy();
    });

    it('restores historical session messages in chronological order without fake badges or product cards', async () => {
      // Mock session messages query responding with historical messages
      mockedUseAiSessionMessages.mockImplementation((sessionId) => {
        if (sessionId === 'session-history-1') {
          return {
            data: mockHistoricalMessages,
            isLoading: false,
            isError: false,
            isSuccess: true,
            error: null,
            refetch: jest.fn(),
          } as any;
        }
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          isSuccess: false,
          error: null,
          refetch: jest.fn(),
        } as any;
      });

      const { getByText, getAllByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Open drawer
      fireEvent.press(getByText('History'));

      // Tap on the session card
      const sessionButtons = getAllByText(/^Conversation [0-9]/);
      fireEvent.press(sessionButtons[0]);

      // Wait for conversation to be restored
      await waitFor(() => {
        expect(getByText('Do you have Sony headphones?')).toBeTruthy();
        expect(getByText('Yes, the store has several good noise-cancelling Sony headphones.')).toBeTruthy();
      });

      // Historical messages must NOT show fake AI/RULES badges or product cards
      expect(queryByText('AI')).toBeNull();
      expect(queryByText('Quick reply')).toBeNull();
      expect(queryByText('Sony Noise-Cancelling Headphones')).toBeNull();
    });

    it('continues restored session: next question sends selected sessionId and displays live AI response', async () => {
      mockedUseAiSessionMessages.mockImplementation((sessionId) => {
        if (sessionId === 'session-history-1') {
          return {
            data: mockHistoricalMessages,
            isLoading: false,
            isError: false,
            isSuccess: true,
            error: null,
            refetch: jest.fn(),
          } as any;
        }
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          isSuccess: false,
          error: null,
          refetch: jest.fn(),
        } as any;
      });

      mockMutateAsync.mockResolvedValueOnce({
        answer: 'The WH-1000XM5 costs 6.490.000 ₫.',
        query: null,
        products: [
          {
            id: 'p-100',
            name: 'Sony WH-1000XM5',
            imageUrl: null,
            price: '6490000.00',
            stock: 6,
            ratingAverage: '4.90',
            reviewCount: 50,
            sellerId: 's-1',
          },
        ],
        sessionId: 'session-history-1',
        answeredBy: 'AI',
      });

      const { getByText, getAllByText, getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Open drawer & select session
      fireEvent.press(getByText('History'));
      const sessionButtons = getAllByText(/^Conversation [0-9]/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Do you have Sony headphones?')).toBeTruthy();
      });

      // Send next message
      const input = getByLabelText('Enter a question for the AI assistant');
      const sendButton = getByRole('button', { name: 'Send question' });

      fireEvent.changeText(input, 'How much is it?');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nHow much is it?',
        sessionId: 'session-history-1',
      });

      await waitFor(() => {
        expect(getByText('The WH-1000XM5 costs 6.490.000 ₫.')).toBeTruthy();
        expect(getByText('AI')).toBeTruthy();
        expect(getByText('Sony WH-1000XM5')).toBeTruthy();
      });
    });

    it('new chat button clears conversation and activeSessionId; next question omits sessionId', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // First question creates session 'session-cust-123'
      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Ask the first question');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
      });

      // Press "New chat"
      fireEvent.press(getByText('New chat'));

      // Messages should be cleared and empty greeting restored
      expect(queryByText('I found 2 headphone models for you.')).toBeNull();
      expect(getByText('Hello! I am your shopping assistant.')).toBeTruthy();

      // Subsequent question must omit sessionId
      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Start a new chat');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      expect(mockMutateAsync).toHaveBeenLastCalledWith({
        message: 'Vui lòng trả lời bằng tiếng Việt.\n\nStart a new chat',
      });
    });

    it('invalidates sessions query cache when customer first turn creates a new session', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Create new session');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: queryKeys.ai.sessions(),
        });
      });
    });

    it('preserves current messages on 404 session load failure and displays error banner', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      // Session load hook fails with 404
      mockedUseAiSessionMessages.mockImplementation((sessionId) => {
        if (sessionId === 'deleted-session') {
          return {
            data: undefined,
            isLoading: false,
            isError: true,
            isSuccess: false,
            error: new ApiError('Session not found', 'RESOURCE_NOT_FOUND', 404),
            refetch: jest.fn(),
          } as any;
        }
        return {
          data: undefined,
          isLoading: false,
          isError: false,
          isSuccess: false,
          error: null,
          refetch: jest.fn(),
        } as any;
      });

      const { getByLabelText, getByRole, getByText, getAllByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Existing conversation
      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Current message');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Current message')).toBeTruthy();
      });

      // Open drawer & trigger 404 session
      mockedUseAiSessions.mockReturnValueOnce({
        data: [{ id: 'deleted-session', userId: 'cust-1', createdAt: '2026-10-20T10:00:00Z' }],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      fireEvent.press(getByText('History'));
      const sessionButtons = getAllByText(/^Conversation [0-9]/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getAllByText('This conversation no longer exists.').length).toBeGreaterThanOrEqual(1);
      });

      // Existing chat must NOT be wiped out!
      expect(getByText('Current message')).toBeTruthy();
    });

    it('clears server-restored session state and closes drawer when customer logs out', async () => {
      mockedUseAiSessionMessages.mockReturnValue({
        data: mockHistoricalMessages,
        isLoading: false,
        isError: false,
        isSuccess: true,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByText, getAllByText, queryByText, rerender } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Restore session
      fireEvent.press(getByText('History'));
      const sessionButtons = getAllByText(/^Conversation [0-9]/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Do you have Sony headphones?')).toBeTruthy();
      });

      // Customer logs out
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      rerender(<AiAssistantScreen navigation={navigation} route={{} as never} />);

      await waitFor(() => {
        expect(queryByText('Do you have Sony headphones?')).toBeNull();
        expect(getByText('Hello! I am your shopping assistant.')).toBeTruthy();
        expect(queryByText('History')).toBeNull();
      });
    });
  });

  describe('Resilience, retry, stale response guard, and UX polish (Phase 5)', () => {
    it('failed send keeps user message visible with failure indicator and allows explicit retry', async () => {
      mockMutateAsync.mockRejectedValueOnce(
        new ApiError('Network Error', 'NETWORK_ERROR', null),
      );

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Ask a question to test the error');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Ask a question to test the error')).toBeTruthy();
        expect(getByText('Failed to send')).toBeTruthy();
      });

      // Explicit retry succeeds
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);
      fireEvent.press(getByRole('button', { name: 'Retry sending question' }));

      await waitFor(() => {
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
      });
    });

    it('retry does not duplicate user message bubble', async () => {
      mockMutateAsync
        .mockRejectedValueOnce(new ApiError('Network Error', 'NETWORK_ERROR', null))
        .mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText, getAllByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Only message');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Failed to send')).toBeTruthy();
      });

      fireEvent.press(getByRole('button', { name: 'Retry sending question' }));

      await waitFor(() => {
        expect(getByText('I found 2 headphone models for you.')).toBeTruthy();
      });

      // Verify user message only appears once
      expect(getAllByText('Only message').length).toBe(1);
    });

    it('stale response from old conversation does not append after New Chat', async () => {
      let resolveLateResponse: (val: any) => void = () => {};
      const pendingPromise = new Promise((resolve) => {
        resolveLateResponse = resolve;
      });
      mockMutateAsync.mockReturnValueOnce(pendingPromise);

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Old abandoned question');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      // While in flight, user taps "New chat"
      fireEvent.press(getByText('New chat'));

      expect(getByText('Hello! I am your shopping assistant.')).toBeTruthy();

      // Late response resolves
      await act(async () => {
        resolveLateResponse(mockAiResponse);
      });

      // Stale assistant answer must NOT appear in the fresh chat!
      expect(queryByText('I found 2 headphone models for you.')).toBeNull();
    });

    it('stale response does not append after switching sessions', async () => {
      mockedUseAuth.mockReturnValue({
        user: CUSTOMER_USER,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      let resolveLateResponse: (val: any) => void = () => {};
      const pendingPromise = new Promise((resolve) => {
        resolveLateResponse = resolve;
      });
      mockMutateAsync.mockReturnValueOnce(pendingPromise);

      mockedUseAiSessionMessages.mockReturnValue({
        data: mockHistoricalMessages,
        isLoading: false,
        isError: false,
        isSuccess: true,
        error: null,
        refetch: jest.fn(),
      } as any);

      const { getByLabelText, getByRole, getByText, getAllByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      // Send in session A
      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Question Session A');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      // Switch to Session B via drawer
      fireEvent.press(getByText('History'));
      const sessionButtons = getAllByText(/^Conversation [0-9]/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Do you have Sony headphones?')).toBeTruthy();
      });

      // Late response resolves
      await act(async () => {
        resolveLateResponse(mockAiResponse);
      });

      // Stale response from Session A must NOT be appended into Session B!
      expect(queryByText('I found 2 headphone models for you.')).toBeNull();
    });

    it('composer displays character counter when input length is >= 900', () => {
      const { getByLabelText, getByTestId, queryByTestId } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Enter a question for the AI assistant');

      // Normal length: no counter
      fireEvent.changeText(input, 'A short normal question');
      expect(queryByTestId('composer-char-counter')).toBeNull();

      // Length 920: shows counter
      const longText = 'A'.repeat(920);
      fireEvent.changeText(input, longText);
      const counter = getByTestId('composer-char-counter');
      expect(counter).toBeTruthy();
      expect(counter.props.children.join('')).toBe('920/1000');
    });

    it('displays friendly message on 400 validation error', async () => {
      mockMutateAsync.mockRejectedValueOnce(
        new ApiError('Invalid message format', 'VALIDATION_ERROR', 400),
      );

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Enter a question for the AI assistant'), 'Question with a syntax error');
      fireEvent.press(getByRole('button', { name: 'Send question' }));

      await waitFor(() => {
        expect(getByText('Please check the question again.')).toBeTruthy();
      });
    });

    it('configures KeyboardAvoidingView behavior appropriately for the platform', () => {
      const { UNSAFE_getByType } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      const expectedBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
      expect(kav.props.behavior).toBe(expectedBehavior);
    });
  });
});
