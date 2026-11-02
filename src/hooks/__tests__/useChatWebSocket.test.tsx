import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';

import { useAuth } from '../useAuth';
import { useChatWebSocket } from '../useChatWebSocket';
import { ChatWebSocketClient } from '../../services/chatWebSocketClient';
import { getAccessToken } from '../../services/tokenStorage';
import type { User } from '../../types/auth';
import type { MessageCreatedEvent, MessagesReadEvent } from '../../types/chatApi';
import * as chatCacheUpdates from '../../utils/chatCacheUpdates';

jest.mock('../useAuth');
jest.mock('../../services/tokenStorage');
jest.mock('../../utils/chatCacheUpdates');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedGetAccessToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>;

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useChatWebSocket hook', () => {
  let mockClient: jest.Mocked<ChatWebSocketClient>;
  let stateListeners: ((state: any) => void)[];
  let eventListeners: ((event: any) => void)[];
  let resyncListeners: (() => void)[];

  const mockCustomerUser: User = {
    id: 'cust-1',
    email: 'cust@test.com',
    name: 'Customer 1',
    role: 'CUSTOMER',
  };

  const mockSellerUser: User = {
    id: 'seller-2',
    email: 'seller@test.com',
    name: 'Seller 2',
    role: 'SELLER',
  };

  const mockAdminUser: User = {
    id: 'admin-3',
    email: 'admin@test.com',
    name: 'Admin 3',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stateListeners = [];
    eventListeners = [];
    resyncListeners = [];

    mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getConnectionState: jest.fn().mockReturnValue('disconnected'),
      onConnectionStateChange: jest.fn().mockImplementation((listener) => {
        stateListeners.push(listener);
        return () => {
          const idx = stateListeners.indexOf(listener);
          if (idx >= 0) stateListeners.splice(idx, 1);
        };
      }),
      onEvent: jest.fn().mockImplementation((listener) => {
        eventListeners.push(listener);
        return () => {
          const idx = eventListeners.indexOf(listener);
          if (idx >= 0) eventListeners.splice(idx, 1);
        };
      }),
      onResync: jest.fn().mockImplementation((listener) => {
        resyncListeners.push(listener);
        return () => {
          const idx = resyncListeners.indexOf(listener);
          if (idx >= 0) resyncListeners.splice(idx, 1);
        };
      }),
      destroy: jest.fn(),
    } as any;
  });

  describe('role-based access control', () => {
    it('does NOT connect for Guest (unauthenticated) and calls disconnect', () => {
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
      mockedGetAccessToken.mockReturnValue(null);

      const queryClient = makeClient();
      const { result } = renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      expect(mockClient.connect).not.toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('does NOT connect for Admin role and calls disconnect', () => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('admin-token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      expect(mockClient.connect).not.toHaveBeenCalled();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('connects when user is authenticated with CUSTOMER role', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('valid-customer-token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      expect(mockClient.connect).toHaveBeenCalledWith('valid-customer-token');
    });

    it('connects when user is authenticated with SELLER role', () => {
      mockedUseAuth.mockReturnValue({
        user: mockSellerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('valid-seller-token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      expect(mockClient.connect).toHaveBeenCalledWith('valid-seller-token');
    });
  });

  describe('event bridging to React Query cache', () => {
    it('calls handleChatMessageCreated when MESSAGE_CREATED event is received', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      const event: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message: {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'seller-2',
          content: 'Hello',
          imageUrl: null,
          isRead: false,
          createdAt: '2026-10-30T10:00:00Z',
        },
      };

      act(() => {
        eventListeners.forEach((listener) => listener(event));
      });

      expect(chatCacheUpdates.handleChatMessageCreated).toHaveBeenCalledWith(
        queryClient,
        event,
      );
    });

    it('calls handleChatMessagesRead when MESSAGES_READ event is received', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      const event: MessagesReadEvent = {
        type: 'MESSAGES_READ',
        conversationId: 'conv-1',
        readerId: 'seller-2',
      };

      act(() => {
        eventListeners.forEach((listener) => listener(event));
      });

      expect(chatCacheUpdates.handleChatMessagesRead).toHaveBeenCalledWith(
        queryClient,
        event,
      );
    });

    it('calls resyncChatQueries when onResync fires', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('token');

      const queryClient = makeClient();
      renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      act(() => {
        resyncListeners.forEach((listener) => listener());
      });

      expect(chatCacheUpdates.resyncChatQueries).toHaveBeenCalledWith(queryClient);
    });
  });

  describe('connection state & control methods', () => {
    it('updates connectionState when onConnectionStateChange fires', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('token');

      const queryClient = makeClient();
      const { result } = renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      expect(result.current.connectionState).toBe('disconnected');

      act(() => {
        stateListeners.forEach((listener) => listener('connected'));
      });

      expect(result.current.connectionState).toBe('connected');

      act(() => {
        stateListeners.forEach((listener) => listener('reconnecting'));
      });

      expect(result.current.connectionState).toBe('reconnecting');
    });

    it('provides manual reconnect and disconnect functions', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });
      mockedGetAccessToken.mockReturnValue('token');

      const queryClient = makeClient();
      const { result } = renderHook(() => useChatWebSocket(mockClient), {
        wrapper: wrapper(queryClient),
      });

      act(() => {
        result.current.disconnect();
      });
      expect(mockClient.disconnect).toHaveBeenCalled();

      act(() => {
        result.current.reconnect();
      });
      expect(mockClient.connect).toHaveBeenCalledWith('token');
    });
  });
});
