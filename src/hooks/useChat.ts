/**
 * TanStack Query hooks for Human Real-Time Customer–Seller Chat.
 *
 * Hooks:
 * - `useConversations`: query hook for listing caller's conversations.
 * - `useConversationMessages`: infinite query hook for loading paginated message history.
 * - `useOpenConversation`: mutation hook for opening (get-or-create) a conversation.
 * - `useSendMessage`: mutation hook for sending a message with explicit caller-controlled idempotency key.
 * - `useMarkConversationRead`: mutation hook for marking unread messages as read.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import {
  CHAT_MESSAGES_PAGE_SIZE,
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from '../services/chatService';
import type {
  ConversationResponse,
  MessageResponse,
  OpenConversationRequest,
  PageResponse,
  SendMessageRequest,
} from '../types/chatApi';
import { addTempMessage, settleTempMessage, tempMessageId } from '../utils/chatCacheUpdates';

export type UseConversationsOptions = {
  enabled?: boolean;
};

export type UseConversationMessagesOptions = {
  enabled?: boolean;
  size?: number;
};

export type SendMessageVariables = {
  conversationId: string;
  request: SendMessageRequest;
  idempotencyKey: string;
  /** Người gửi, để hiện tin tạm đúng phía trong lúc chờ server. */
  senderId: string;
};

/**
 * Query hook for listing conversations owned by the caller (CUSTOMER or SELLER).
 */
export function useConversations(options?: UseConversationsOptions | boolean) {
  const isEnabled = typeof options === 'boolean' ? options : options?.enabled ?? true;

  return useQuery<ConversationResponse[]>({
    queryKey: queryKeys.chat.conversations(),
    queryFn: listConversations,
    enabled: isEnabled,
  });
}

/**
 * Infinite query hook for loading paginated message history of a conversation.
 *
 * - Page index starts at 0.
 * - Returns newest messages first per page.
 * - Automatically advances to older messages on fetchNextPage().
 * - Stops when `page + 1 >= totalPages`.
 */
export function useConversationMessages(
  conversationId?: string | null,
  options?: UseConversationMessagesOptions | boolean,
) {
  const isEnabled = typeof options === 'boolean' ? options : options?.enabled ?? true;
  const pageSize =
    typeof options === 'object' && options?.size != null
      ? options.size
      : CHAT_MESSAGES_PAGE_SIZE;
  const hasValidId = typeof conversationId === 'string' && conversationId.trim().length > 0;

  return useInfiniteQuery<
    PageResponse<MessageResponse>,
    Error,
    InfiniteData<PageResponse<MessageResponse>>,
    readonly [string, string, string, string],
    number
  >({
    queryKey: queryKeys.chat.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) => listMessages(conversationId!, pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const totalPages = lastPage.totalPages;
      const currentPage = lastPage.page;
      if (typeof totalPages === 'number' && totalPages >= 0) {
        if (currentPage + 1 >= totalPages) {
          return undefined;
        }
      }
      return currentPage + 1;
    },
    enabled: isEnabled && hasValidId,
  });
}

/**
 * Mutation hook for opening / get-or-create a conversation.
 * Invalidates conversations list upon success.
 */
export function useOpenConversation() {
  const queryClient = useQueryClient();

  return useMutation<ConversationResponse, Error, OpenConversationRequest>({
    mutationFn: (request: OpenConversationRequest) => openConversation(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations() });
    },
  });
}

/**
 * Mutation hook for sending a message.
 *
 * Expects caller-supplied `idempotencyKey` so retries can reuse the exact same key.
 * Cập nhật lạc quan: tin tạm hiện ngay, thành công thì thay bằng tin thật, lỗi thì xoá để màn hình tạo
 * bong bóng gửi lại. Invalidates message history and conversation list (due to lastMessageAt update).
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<MessageResponse, Error, SendMessageVariables>({
    mutationFn: ({ conversationId, request, idempotencyKey }: SendMessageVariables) =>
      sendMessage(conversationId, request, idempotencyKey),
    onMutate: async ({ conversationId, request, idempotencyKey, senderId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.messages(conversationId) });
      addTempMessage(queryClient, {
        id: tempMessageId(idempotencyKey),
        conversationId,
        senderId,
        content: request.content ?? '',
        imageUrl: request.imageUrl ?? null,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (message, { conversationId, idempotencyKey }) => {
      settleTempMessage(queryClient, conversationId, tempMessageId(idempotencyKey), message);
    },
    onError: (_error, { conversationId, idempotencyKey }) => {
      settleTempMessage(queryClient, conversationId, tempMessageId(idempotencyKey));
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(variables.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.conversations(),
      });
    },
  });
}

/**
 * Mutation hook for marking all unread messages from the other participant as read.
 * Invalidates message history for the marked conversation.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(conversationId),
      });
    },
  });
}
