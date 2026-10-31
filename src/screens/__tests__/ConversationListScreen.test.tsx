import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import ConversationListScreen from '../ConversationListScreen';
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

describe('ConversationListScreen', () => {
  const mockNavigate = jest.fn();
  const mockRefetch = jest.fn();

  const navigation = {
    navigate: mockNavigate,
  } as any;

  const mockConversation: ConversationResponse = {
    id: 'conv-1111',
    customerId: 'cust-2222',
    sellerId: 'seller-3333',
    productId: null,
    orderId: null,
    createdAt: '2026-10-30T10:00:00Z',
    lastMessageAt: '2026-10-30T10:30:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseChatWebSocket.mockReturnValue({
      connectionState: 'connected',
      reconnect: jest.fn(),
      disconnect: jest.fn(),
    });
  });

  describe('Role-based access gating', () => {
    it('blocks Guest users and provides navigation to Login', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Yêu cầu đăng nhập')).toBeTruthy();
      expect(
        getByText('Bạn cần đăng nhập bằng tài khoản Người mua hoặc Người bán để xem tin nhắn.'),
      ).toBeTruthy();

      fireEvent.press(getByText('Đăng nhập'));
      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('blocks Admin role from accessing Human Chat inbox', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'admin-1', role: 'ADMIN', name: 'Admin', email: 'admin@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Yêu cầu đăng nhập')).toBeTruthy();
    });
  });

  describe('Loading and Error states', () => {
    it('renders loading indicator while fetching initial conversations', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Đang tải tin nhắn…')).toBeTruthy();
    });

    it('renders error state and retries on press', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Không thể tải tin nhắn')).toBeTruthy();

      fireEvent.press(getByText('Thử lại'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty states', () => {
    it('renders customer-tailored empty state when Customer has no conversations', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Chưa có cuộc trò chuyện nào')).toBeTruthy();
      expect(getByText('Tin nhắn giữa bạn và các shop sẽ xuất hiện ở đây.')).toBeTruthy();
    });

    it('renders seller-tailored empty state when Seller has no conversations', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'seller-1', role: 'SELLER', name: 'Seller', email: 'seller@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Chưa có tin nhắn từ khách hàng')).toBeTruthy();
      expect(getByText('Các cuộc hội thoại từ khách hàng sẽ xuất hiện ở đây.')).toBeTruthy();
    });
  });

  describe('Populated state and row interaction', () => {
    it('renders conversation list when data is populated', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [mockConversation],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByText } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      expect(getByText('Shop #seller-3')).toBeTruthy();
    });

    it('navigates to ChatRoom screen when row is tapped in Phase 4', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-1', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversations.mockReturnValue({
        data: [mockConversation],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByRole } = render(
        <ConversationListScreen navigation={navigation} route={{} as any} />,
      );

      const rowButton = getByRole('button');
      fireEvent.press(rowButton);

      expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', {
        conversationId: 'conv-1111',
        counterpartRole: 'SELLER',
      });
    });
  });
});
