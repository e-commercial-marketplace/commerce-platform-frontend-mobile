import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import ChatRoomScreen from '../ChatRoomScreen';
import { useAuth } from '../../hooks/useAuth';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationRead,
  useSendMessage,
} from '../../hooks/useChat';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useSellerShop } from '../../hooks/useSellers';
import type { MessageResponse } from '../../types/chatApi';
import { pickImage } from '../../utils/imagePicker';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useChat');
jest.mock('../../hooks/useChatWebSocket');
jest.mock('../../hooks/useSellers');
jest.mock('../../hooks/useImageUpload', () => ({ useImageUpload: jest.fn() }));
jest.mock('../../utils/imagePicker', () => ({ pickImage: jest.fn() }));

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

describe('ChatRoomScreen', () => {
  const mockNavigate = jest.fn();
  const mockSetOptions = jest.fn();
  const mockRefetch = jest.fn();
  const mockFetchNextPage = jest.fn();
  const mockSendMessageMutateAsync = jest.fn();
  const mockMarkReadMutate = jest.fn();
  const mockReconnect = jest.fn();
  const mockUploadMutateAsync = jest.fn();

  const navigation = {
    navigate: mockNavigate,
    setOptions: mockSetOptions,
  } as any;

  const baseRoute = {
    params: {
      conversationId: 'conv-123',
    },
  } as any;

  const mockMessage: MessageResponse = {
    id: 'msg-1',
    conversationId: 'conv-123',
    senderId: 'user-seller',
    content: 'Hello, how can the shop help you?',
    imageUrl: null,
    isRead: false,
    createdAt: '2026-10-30T10:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useImageUpload as jest.Mock).mockReturnValue({
      mutateAsync: mockUploadMutateAsync,
      isPending: false,
    });

    mockedUseChatWebSocket.mockReturnValue({
      connectionState: 'connected',
      reconnect: mockReconnect,
      disconnect: jest.fn(),
    });

    mockedUseConversations.mockReturnValue({
      data: [
        {
          id: 'conv-123',
          customerId: 'cust-456',
          sellerId: 'seller-789',
          productId: null,
          orderId: null,
          createdAt: '2026-10-30T09:00:00Z',
          lastMessageAt: '2026-10-30T10:00:00Z',
        },
      ],
    } as any);

    mockedUseSellerShop.mockReturnValue({
      data: { id: 'seller-789', name: 'Tech Store Official' } as any,
      isLoading: false,
    } as any);

    mockedUseSendMessage.mockReturnValue({
      mutateAsync: mockSendMessageMutateAsync,
      isPending: false,
    } as any);

    mockedUseMarkConversationRead.mockReturnValue({
      mutate: mockMarkReadMutate,
    } as any);
  });

  describe('Sending images', () => {
    const picked = { uri: 'file:///photo.jpg', name: 'image.jpg', type: 'image/jpeg' };
    const url = 'https://res.cloudinary.com/demo/image/upload/chat/a.jpg';

    const renderRoom = () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'C', email: 'c@test.com' },
        isAuthenticated: true,
      } as any);
      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], last: true }] },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);
      return render(<ChatRoomScreen navigation={navigation} route={baseRoute} />);
    };

    it('uploads and sends right after picking, keeping the typed text', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce(picked);
      mockUploadMutateAsync.mockResolvedValueOnce(url);
      mockSendMessageMutateAsync.mockResolvedValueOnce({});
      const { getByLabelText } = renderRoom();

      fireEvent.changeText(getByLabelText('Enter a message'), 'not sent yet');
      fireEvent.press(getByLabelText('Send image'));

      await waitFor(() => {
        expect(mockSendMessageMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ conversationId: 'conv-123', request: { imageUrl: url } }),
        );
      });
      expect(getByLabelText('Enter a message').props.value).toBe('not sent yet');
    });

    it('does nothing when the picker is cancelled', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce(null);
      const { getByLabelText } = renderRoom();

      fireEvent.press(getByLabelText('Send image'));

      await waitFor(() => expect(pickImage).toHaveBeenCalled());
      expect(mockUploadMutateAsync).not.toHaveBeenCalled();
      expect(mockSendMessageMutateAsync).not.toHaveBeenCalled();
    });

    it('only alerts when the upload fails', async () => {
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (pickImage as jest.Mock).mockResolvedValueOnce(picked);
      mockUploadMutateAsync.mockRejectedValueOnce(new Error('boom'));
      const { getByLabelText } = renderRoom();

      fireEvent.press(getByLabelText('Send image'));

      await waitFor(() => expect(alert).toHaveBeenCalled());
      expect(mockSendMessageMutateAsync).not.toHaveBeenCalled();
    });

    it('retries a failed image with the same key and without uploading again', async () => {
      (pickImage as jest.Mock).mockResolvedValueOnce(picked);
      mockUploadMutateAsync.mockResolvedValueOnce(url);
      mockSendMessageMutateAsync.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
      const { getByLabelText, findByLabelText } = renderRoom();

      fireEvent.press(getByLabelText('Send image'));
      fireEvent.press(await findByLabelText('Retry sending message'));

      await waitFor(() => expect(mockSendMessageMutateAsync).toHaveBeenCalledTimes(2));
      const [first, second] = mockSendMessageMutateAsync.mock.calls.map((call) => call[0]);
      expect(second.request).toEqual({ imageUrl: url });
      expect(second.idempotencyKey).toBe(first.idempotencyKey);
      expect(mockUploadMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Role Gating & Authentication', () => {
    it('blocks Guest users and provides navigation to Login', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Sign-in required')).toBeTruthy();
      fireEvent.press(getByText('Sign in'));
      expect(mockNavigate).toHaveBeenCalledWith('Login');
    });

    it('blocks Admin role from participating in human chat room', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'admin-1', role: 'ADMIN', name: 'Admin', email: 'admin@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Sign-in required')).toBeTruthy();
    });
  });

  describe('Counterpart Header Resolution', () => {
    it('resolves shop name when customer visits chat room', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      render(<ChatRoomScreen navigation={navigation} route={baseRoute} />);

      expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Tech Store Official' });
    });

    it('resolves neutral customer identity when seller visits chat room', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'seller-789', role: 'SELLER', name: 'Seller', email: 'seller@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      render(<ChatRoomScreen navigation={navigation} route={baseRoute} />);

      expect(mockSetOptions).toHaveBeenCalledWith({ title: 'Customer #cust-456' });
    });
  });

  describe('Real-time Connection Notice Banner', () => {
    it('renders reconnecting banner when connectionState is reconnecting', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseChatWebSocket.mockReturnValue({
        connectionState: 'reconnecting',
        reconnect: mockReconnect,
        disconnect: jest.fn(),
      });

      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Reconnecting in real time…')).toBeTruthy();
    });

    it('renders disconnected banner with reconnect button when connectionState is disconnected', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseChatWebSocket.mockReturnValue({
        connectionState: 'disconnected',
        reconnect: mockReconnect,
        disconnect: jest.fn(),
      });

      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Real-time connection lost')).toBeTruthy();
      const reconnectBtn = getByText('Reconnect');
      fireEvent.press(reconnectBtn);
      expect(mockReconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message History & Pagination', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);
    });

    it('renders loading state when fetching initial messages', () => {
      mockedUseConversationMessages.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Loading messages…')).toBeTruthy();
    });

    it('renders error state with retry button when initial fetch fails', () => {
      mockedUseConversationMessages.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Could not load messages')).toBeTruthy();
      fireEvent.press(getByText('Retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty placeholder when conversation has zero messages', () => {
      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [], page: 0, totalPages: 0 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('No messages yet')).toBeTruthy();
      expect(
        getByText('Send the first message to start the conversation.'),
      ).toBeTruthy();
    });

    it('renders message bubbles when history is populated', () => {
      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      const { getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(getByText('Hello, how can the shop help you?')).toBeTruthy();
    });
  });

  describe('Mark Conversation Read', () => {
    it('calls markRead on mount and when counterpart unread messages exist', () => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: {
          pages: [
            {
              content: [{ ...mockMessage, senderId: 'seller-789', isRead: false }],
              page: 0,
              totalPages: 1,
            },
          ],
        } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);

      render(<ChatRoomScreen navigation={navigation} route={baseRoute} />);

      expect(mockMarkReadMutate).toHaveBeenCalledWith('conv-123');
    });
  });

  describe('Sending Message & Idempotency', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: { id: 'cust-456', role: 'CUSTOMER', name: 'Customer', email: 'cust@test.com' },
        isAuthenticated: true,
      } as any);

      mockedUseConversationMessages.mockReturnValue({
        data: { pages: [{ content: [mockMessage], page: 0, totalPages: 1 }] } as any,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      } as any);
    });

    it('disables send button when composer input is empty or whitespace only', () => {
      const { getByLabelText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      const sendBtn = getByLabelText('Send message');
      const input = getByLabelText('Enter a message');

      // Initially empty
      fireEvent.press(sendBtn);
      expect(mockSendMessageMutateAsync).not.toHaveBeenCalled();

      // Whitespace only
      fireEvent.changeText(input, '    ');
      fireEvent.press(sendBtn);
      expect(mockSendMessageMutateAsync).not.toHaveBeenCalled();
    });

    it('sends message via REST API with a valid client Idempotency-Key', async () => {
      mockSendMessageMutateAsync.mockResolvedValueOnce({
        id: 'msg-new',
        conversationId: 'conv-123',
        senderId: 'cust-456',
        content: 'Can I ask about the delivery time',
        imageUrl: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      const { getByLabelText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      const input = getByLabelText('Enter a message');
      const sendBtn = getByLabelText('Send message');

      fireEvent.changeText(input, 'Can I ask about the delivery time');
      fireEvent.press(sendBtn);

      await waitFor(() => {
        expect(mockSendMessageMutateAsync).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSendMessageMutateAsync.mock.calls[0][0];
      expect(callArgs.conversationId).toBe('conv-123');
      expect(callArgs.request.content).toBe('Can I ask about the delivery time');
      expect(typeof callArgs.idempotencyKey).toBe('string');
      expect(callArgs.idempotencyKey.length).toBeGreaterThanOrEqual(1);
      expect(callArgs.idempotencyKey.length).toBeLessThanOrEqual(100);
    });

        it('preserves and reuses the EXACT SAME idempotencyKey on retry when sending fails', async () => {
      // First attempt fails
      mockSendMessageMutateAsync.mockRejectedValueOnce(new Error('Network error'));

      const { getByLabelText, getByText } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      const input = getByLabelText('Enter a message');
      const sendBtn = getByLabelText('Send message');

      fireEvent.changeText(input, 'Failed message');
      fireEvent.press(sendBtn);

      await waitFor(() => {
        expect(mockSendMessageMutateAsync).toHaveBeenCalledTimes(1);
      });

      const firstKey = mockSendMessageMutateAsync.mock.calls[0][0].idempotencyKey;
      expect(firstKey).toBeTruthy();

      // Failed bubble with retry button should appear
      await waitFor(() => {
        expect(getByText('⚠️ Send failed')).toBeTruthy();
      });

      const retryBtn = getByText('Retry');
      expect(retryBtn).toBeTruthy();

      // Second attempt succeeds on retry
      mockSendMessageMutateAsync.mockResolvedValueOnce({
        id: 'msg-success',
        conversationId: 'conv-123',
        senderId: 'cust-456',
        content: 'Failed message',
        imageUrl: null,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      fireEvent.press(retryBtn);

      await waitFor(() => {
        expect(mockSendMessageMutateAsync).toHaveBeenCalledTimes(2);
      });

      const retryKey = mockSendMessageMutateAsync.mock.calls[1][0].idempotencyKey;
      // CRITICAL CONTRACT: Retry must reuse the identical idempotencyKey
      expect(retryKey).toBe(firstKey);
    });
  });

  describe('Keyboard Handling & Layout', () => {
    it('registers keyboard listeners on mount and unregisters on unmount', () => {
      const addListenerSpy = jest.spyOn(Keyboard, 'addListener');
      const { unmount } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      expect(addListenerSpy).toHaveBeenCalled();
      unmount();
      addListenerSpy.mockRestore();
    });

    it('tracks dynamic keyboard height on Android and adjusts paddingBottom', () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';

      let showCallback: (e: any) => void = () => {};
      let hideCallback: () => void = () => {};

      const addListenerSpy = jest
        .spyOn(Keyboard, 'addListener')
        .mockImplementation((eventName: string, handler: any) => {
          if (eventName === 'keyboardDidShow') showCallback = handler;
          if (eventName === 'keyboardDidHide') hideCallback = handler;
          return { remove: jest.fn() } as any;
        });

      const { UNSAFE_getByType } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      // Simulate keyboard opening on Android with 300px height
      act(() => {
        showCallback({ endCoordinates: { height: 300 } });
      });

      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      const flattenedStyle = StyleSheet.flatten(kav.props.style);
      expect(flattenedStyle.paddingBottom).toBe(300);

      // Simulate keyboard closing
      act(() => {
        hideCallback();
      });

      const resetStyle = StyleSheet.flatten(kav.props.style);
      expect(resetStyle.paddingBottom).toBeUndefined();

      (Platform as any).OS = originalOS;
      addListenerSpy.mockRestore();
    });

    it('configures iOS with padding behavior and header offset', () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'ios';

      const { UNSAFE_getByType } = render(
        <ChatRoomScreen navigation={navigation} route={baseRoute} />,
      );

      const kav = UNSAFE_getByType(KeyboardAvoidingView);
      expect(kav.props.behavior).toBe('padding');
      expect(kav.props.keyboardVerticalOffset).toBe(90);

      (Platform as any).OS = originalOS;
    });
  });
});