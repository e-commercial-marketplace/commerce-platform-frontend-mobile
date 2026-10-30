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
  answer: 'Mình tìm thấy 2 mẫu tai nghe cho bạn.',
  query: null,
  products: [
    {
      id: 'p-1',
      name: 'Tai nghe chống ồn Sony',
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
  answer: 'Marketplace có 2 cách thanh toán: COD và VNPAY.',
  query: null,
  products: [],
  sessionId: 'session-cust-123',
  answeredBy: 'RULES',
};

const mockRulesResponseWithProducts: AiProductSearchResponse = {
  answer: 'Gợi ý sản phẩm tìm kiếm theo quy tắc:',
  query: null,
  products: [
    {
      id: 'p-rules-1',
      name: 'Tai nghe chống ồn JBL',
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
    content: 'Bạn có tai nghe Sony không?',
    confidence: null,
    createdAt: '2026-10-30T08:30:10.000Z',
  },
  {
    id: 'hist-msg-2',
    sessionId: 'session-history-1',
    role: 'ASSISTANT',
    content: 'Có, cửa hàng có nhiều mẫu tai nghe Sony chống ồn tốt.',
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

      expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();
      expect(getByText('Bạn muốn tìm sản phẩm hoặc hỏi gì về cửa hàng?')).toBeTruthy();
      expect(getByText('Tìm tai nghe chống ồn dưới 2 triệu')).toBeTruthy();
      expect(getByText('Gợi ý laptop có đánh giá tốt')).toBeTruthy();
      expect(getByText('Có những hình thức thanh toán nào?')).toBeTruthy();
      expect(getByText('Chính sách hủy đơn như thế nào?')).toBeTruthy();
      expect(getByPlaceholderText('Hỏi về sản phẩm, chính sách...')).toBeTruthy();
    });

    it('sends prompt immediately when tapping a suggested prompt', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.press(getByText('Tìm tai nghe chống ồn dưới 2 triệu'));

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Tìm tai nghe chống ồn dưới 2 triệu',
      });

      await waitFor(() => {
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
      });
    });
  });

  describe('Composer validation and double-send prevention', () => {
    it('does not send when input is empty or whitespace only', () => {
      const { getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });
      fireEvent.press(sendButton);
      expect(mockMutateAsync).not.toHaveBeenCalled();

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
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

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

      fireEvent.changeText(input, 'Tìm tai nghe');
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
      expect(queryByText('Lịch sử')).toBeNull();

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

      fireEvent.changeText(input, 'Tìm tai nghe');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Tìm tai nghe',
      });

      await waitFor(() => {
        expect(getByText('Tìm tai nghe')).toBeTruthy();
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
        expect(getByText('AI')).toBeTruthy();
      });
    });

    it('renders RULES response as a successful answer with "Trả lời nhanh" tag', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Thanh toán thế nào');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Marketplace có 2 cách thanh toán: COD và VNPAY.')).toBeTruthy();
        expect(getByText('Trả lời nhanh')).toBeTruthy();
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
      });
    });

    it('omits sessionId on first query, stores returned sessionId, and sends it on second query', async () => {
      mockMutateAsync
        .mockResolvedValueOnce(mockAiResponse) // first turn returns sessionId 'session-cust-123'
        .mockResolvedValueOnce({
          ...mockAiResponse,
          answer: 'Mẫu rẻ nhất là 1.990.000 ₫.',
        });

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

      // First query (omits sessionId)
      fireEvent.changeText(input, 'Tìm tai nghe');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Tìm tai nghe',
      });

      await waitFor(() => {
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
      });

      // Second query (includes activeSessionId 'session-cust-123')
      fireEvent.changeText(input, 'Cái nào rẻ nhất?');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Cái nào rẻ nhất?',
        sessionId: 'session-cust-123',
      });

      await waitFor(() => {
        expect(getByText('Mẫu rẻ nhất là 1.990.000 ₫.')).toBeTruthy();
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Hỏi nhiều câu liên tiếp');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Hỏi nhiều câu liên tiếp')).toBeTruthy(); // User message stays visible
        expect(
          getByText('Bạn đã hỏi quá nhiều câu trong 1 phút. Vui lòng chờ một chút rồi thử lại.'),
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Mạng chập chờn');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Không thể kết nối tới trợ lý lúc này. Vui lòng thử lại.')).toBeTruthy();
      });

      // Close the error banner
      fireEvent.press(getByRole('button', { name: 'Đóng thông báo lỗi' }));
      expect(queryByText('Không thể kết nối tới trợ lý lúc này. Vui lòng thử lại.')).toBeNull();
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
      });

      mockMutateAsync
        .mockResolvedValueOnce(mockAiResponse) // first call establishes sessionId
        .mockRejectedValueOnce(new ApiError('Session not found', 'RESOURCE_NOT_FOUND', 404)) // second call fails with 404
        .mockResolvedValueOnce(mockAiResponse); // third call should omit sessionId

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

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
            'Phiên trò chuyện trước đó đã kết thúc. Câu hỏi tiếp theo sẽ bắt đầu cuộc trò chuyện mới.',
          ),
        ).toBeTruthy();
      });

      // Turn 3: should omit sessionId because it was cleared
      fireEvent.changeText(input, 'Turn 3');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenLastCalledWith({
        message: 'Turn 3',
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
      });

      const { getByText, queryByPlaceholderText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(
        getByText(
          'Trợ lý AI chỉ khả dụng cho Khách hàng và Khách vãng lai để tìm kiếm sản phẩm và giải đáp chính sách.',
        ),
      ).toBeTruthy();
      expect(queryByPlaceholderText('Hỏi về sản phẩm, chính sách...')).toBeNull();
      expect(mockMutateAsync).not.toHaveBeenCalled();

      fireEvent.press(getByText('Quay lại'));
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
      });

      const { getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(
        getByText(
          'Trợ lý AI chỉ khả dụng cho Khách hàng và Khách vãng lai để tìm kiếm sản phẩm và giải đáp chính sách.',
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tìm tai nghe');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Tai nghe chống ồn Sony')).toBeTruthy();
        expect(getByText('1.990.000 ₫')).toBeTruthy();
        expect(getByText('4.8')).toBeTruthy();
        expect(getByText('(45 reviews)')).toBeTruthy();
        expect(getByText('Còn hàng')).toBeTruthy();
      });
    });

    it('does not render any AiProductCard when products array is empty', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponse);

      const { getByLabelText, getByRole, getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Thanh toán thế nào?');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Marketplace có 2 cách thanh toán: COD và VNPAY.')).toBeTruthy();
      });

      expect(queryByText('Tai nghe chống ồn Sony')).toBeNull();
      expect(queryByText('Còn hàng')).toBeNull();
      expect(queryByText('Hết hàng')).toBeNull();
    });

    it('navigates to ProductDetail with productId when tapping a product card', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tìm tai nghe');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Tai nghe chống ồn Sony')).toBeTruthy();
      });

      fireEvent.press(getByText('Tai nghe chống ồn Sony'));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p-1' });
    });

    it('renders product cards for RULES responses containing products and enables navigation', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockRulesResponseWithProducts);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tìm tai nghe JBL');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Gợi ý sản phẩm tìm kiếm theo quy tắc:')).toBeTruthy();
        expect(getByText('Trả lời nhanh')).toBeTruthy();
        expect(getByText('Tai nghe chống ồn JBL')).toBeTruthy();
        expect(getByText('890.000 ₫')).toBeTruthy();
        expect(getByText('Chỉ còn 3')).toBeTruthy();
      });

      fireEvent.press(getByText('Tai nghe chống ồn JBL'));
      expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'p-rules-1' });
    });

    it('does not make any product detail API calls when rendering recommendation cards', async () => {
      const getProductByIdSpy = jest.spyOn(productService, 'getProductById');
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tìm tai nghe');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Tai nghe chống ồn Sony')).toBeTruthy();
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
      });
    });

    it('renders "Lịch sử" button for CUSTOMER and opens drawer on tap', () => {
      const { getByText, queryByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      expect(getByText('Lịch sử')).toBeTruthy();
      expect(getByText('Đoạn chat mới')).toBeTruthy();

      // Open history drawer
      fireEvent.press(getByText('Lịch sử'));

      expect(getByText('Lịch sử trò chuyện')).toBeTruthy();
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
      fireEvent.press(getByText('Lịch sử'));

      // Tap on the session card
      const sessionButtons = getAllByText(/Cuộc trò chuyện/);
      fireEvent.press(sessionButtons[0]);

      // Wait for conversation to be restored
      await waitFor(() => {
        expect(getByText('Bạn có tai nghe Sony không?')).toBeTruthy();
        expect(getByText('Có, cửa hàng có nhiều mẫu tai nghe Sony chống ồn tốt.')).toBeTruthy();
      });

      // Historical messages must NOT show fake AI/RULES badges or product cards
      expect(queryByText('AI')).toBeNull();
      expect(queryByText('Trả lời nhanh')).toBeNull();
      expect(queryByText('Tai nghe chống ồn Sony')).toBeNull();
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
        answer: 'Dòng WH-1000XM5 giá 6.490.000 ₫.',
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
      fireEvent.press(getByText('Lịch sử'));
      const sessionButtons = getAllByText(/Cuộc trò chuyện/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Bạn có tai nghe Sony không?')).toBeTruthy();
      });

      // Send next message
      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');
      const sendButton = getByRole('button', { name: 'Gửi câu hỏi' });

      fireEvent.changeText(input, 'Giá bao nhiêu?');
      fireEvent.press(sendButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        message: 'Giá bao nhiêu?',
        sessionId: 'session-history-1',
      });

      await waitFor(() => {
        expect(getByText('Dòng WH-1000XM5 giá 6.490.000 ₫.')).toBeTruthy();
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
      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Hỏi câu đầu');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
      });

      // Press "Đoạn chat mới"
      fireEvent.press(getByText('Đoạn chat mới'));

      // Messages should be cleared and empty greeting restored
      expect(queryByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeNull();
      expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();

      // Subsequent question must omit sessionId
      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Bắt đầu chat mới');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      expect(mockMutateAsync).toHaveBeenLastCalledWith({
        message: 'Bắt đầu chat mới',
      });
    });

    it('invalidates sessions query cache when customer first turn creates a new session', async () => {
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tạo phiên mới');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

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
      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tin nhắn hiện tại');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Tin nhắn hiện tại')).toBeTruthy();
      });

      // Open drawer & trigger 404 session
      mockedUseAiSessions.mockReturnValueOnce({
        data: [{ id: 'deleted-session', userId: 'cust-1', createdAt: '2026-10-20T10:00:00Z' }],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      } as any);

      fireEvent.press(getByText('Lịch sử'));
      const sessionButtons = getAllByText(/Cuộc trò chuyện/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getAllByText('Cuộc trò chuyện này không còn tồn tại.').length).toBeGreaterThanOrEqual(1);
      });

      // Existing chat must NOT be wiped out!
      expect(getByText('Tin nhắn hiện tại')).toBeTruthy();
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
      fireEvent.press(getByText('Lịch sử'));
      const sessionButtons = getAllByText(/Cuộc trò chuyện/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Bạn có tai nghe Sony không?')).toBeTruthy();
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
      });

      rerender(<AiAssistantScreen navigation={navigation} route={{} as never} />);

      await waitFor(() => {
        expect(queryByText('Bạn có tai nghe Sony không?')).toBeNull();
        expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();
        expect(queryByText('Lịch sử')).toBeNull();
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Hỏi thử nghiệm lỗi');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Hỏi thử nghiệm lỗi')).toBeTruthy();
        expect(getByText('Gửi không thành công')).toBeTruthy();
      });

      // Explicit retry succeeds
      mockMutateAsync.mockResolvedValueOnce(mockAiResponse);
      fireEvent.press(getByRole('button', { name: 'Thử lại gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
      });
    });

    it('retry does not duplicate user message bubble', async () => {
      mockMutateAsync
        .mockRejectedValueOnce(new ApiError('Network Error', 'NETWORK_ERROR', null))
        .mockResolvedValueOnce(mockAiResponse);

      const { getByLabelText, getByRole, getByText, getAllByText } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Tin nhắn duy nhất');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Gửi không thành công')).toBeTruthy();
      });

      fireEvent.press(getByRole('button', { name: 'Thử lại gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeTruthy();
      });

      // Verify user message only appears once
      expect(getAllByText('Tin nhắn duy nhất').length).toBe(1);
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Câu hỏi cũ bị bỏ rơi');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      // While in flight, user taps "Đoạn chat mới"
      fireEvent.press(getByText('Đoạn chat mới'));

      expect(getByText('Xin chào! Mình là trợ lý mua sắm.')).toBeTruthy();

      // Late response resolves
      await act(async () => {
        resolveLateResponse(mockAiResponse);
      });

      // Stale assistant answer must NOT appear in the fresh chat!
      expect(queryByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeNull();
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
      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Câu hỏi Session A');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      // Switch to Session B via drawer
      fireEvent.press(getByText('Lịch sử'));
      const sessionButtons = getAllByText(/Cuộc trò chuyện/);
      fireEvent.press(sessionButtons[0]);

      await waitFor(() => {
        expect(getByText('Bạn có tai nghe Sony không?')).toBeTruthy();
      });

      // Late response resolves
      await act(async () => {
        resolveLateResponse(mockAiResponse);
      });

      // Stale response from Session A must NOT be appended into Session B!
      expect(queryByText('Mình tìm thấy 2 mẫu tai nghe cho bạn.')).toBeNull();
    });

    it('composer displays character counter when input length is >= 900', () => {
      const { getByLabelText, getByTestId, queryByTestId } = render(
        <AiAssistantScreen navigation={navigation} route={{} as never} />,
      );

      const input = getByLabelText('Nhập câu hỏi cho trợ lý AI');

      // Normal length: no counter
      fireEvent.changeText(input, 'Câu hỏi bình thường ngắn gọn');
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

      fireEvent.changeText(getByLabelText('Nhập câu hỏi cho trợ lý AI'), 'Câu hỏi lỗi cú pháp');
      fireEvent.press(getByRole('button', { name: 'Gửi câu hỏi' }));

      await waitFor(() => {
        expect(getByText('Vui lòng kiểm tra lại câu hỏi.')).toBeTruthy();
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
