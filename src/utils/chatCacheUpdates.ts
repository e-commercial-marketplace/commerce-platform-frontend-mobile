/**
 * React Query cache integration helpers for real-time Human Chat.
 *
 * Ensures canonical deduplication by `message.id` and seamless updates
 * to `useInfiniteQuery` paginated message structures.
 */

import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import type {
  ConversationResponse,
  MessageCreatedEvent,
  MessageResponse,
  MessagesReadEvent,
  PageResponse,
} from '../types/chatApi';

type MessagesCache = InfiniteData<PageResponse<MessageResponse>>;

const TEMP_MESSAGE_PREFIX = 'temp_';

/** Id of the temporary message derived from the Idempotency-Key, so resending yields the same id. */
export function tempMessageId(idempotencyKey: string): string {
  return `${TEMP_MESSAGE_PREFIX}${idempotencyKey}`;
}

export function isTempMessage(id: string): boolean {
  return id.startsWith(TEMP_MESSAGE_PREFIX);
}

/** Add the message to the top of the newest page if this id is not there yet. */
function prependUnique(data: MessagesCache, message: MessageResponse): MessagesCache {
  if (data.pages.some((page) => page.content.some((m) => m.id === message.id))) {
    return data;
  }
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [
      { ...first, content: [message, ...first.content], totalElements: first.totalElements + 1 },
      ...rest,
    ],
  };
}

/** Show the message being sent right in the list. Skipped if the cache is not loaded. */
export function addTempMessage(queryClient: QueryClient, temp: MessageResponse): void {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(temp.conversationId), (data) =>
    data?.pages?.length ? prependUnique(data, temp) : data,
  );
}

/**
 * Removes the temporary message; if `real` is given, it inserts the real message. The WebSocket may already have inserted the real message,
 * so `prependUnique` checks the id so it is not duplicated.
 */
export function settleTempMessage(
  queryClient: QueryClient,
  conversationId: string,
  tempId: string,
  real?: MessageResponse,
): void {
  queryClient.setQueryData<MessagesCache>(queryKeys.chat.messages(conversationId), (data) => {
    if (!data?.pages?.length) {
      return data;
    }
    const withoutTemp: MessagesCache = {
      ...data,
      pages: data.pages.map((page) =>
        page.content.some((m) => m.id === tempId)
          ? {
              ...page,
              content: page.content.filter((m) => m.id !== tempId),
              totalElements: page.totalElements - 1,
            }
          : page,
      ),
    };
    return real != null ? prependUnique(withoutTemp, real) : withoutTemp;
  });
}

/**
 * Handles incoming `MESSAGE_CREATED` WebSocket event.
 *
 * Canonical Deduplication:
 * - Backend pushes MESSAGE_CREATED to BOTH participants (including sender).
 * - Sender already received the MessageResponse via the REST call or will receive it.
 * - This function checks if `message.id` already exists across all cached pages.
 * - If found: no change, avoiding duplicate UI items.
 * - If not found: prepends to page 0 (newest-first) and increments totalElements.
 *
 * Also updates/invalidates conversations query because `lastMessageAt` changed.
 */
export function handleChatMessageCreated(
  queryClient: QueryClient,
  event: MessageCreatedEvent,
): void {
  const { message } = event;
  const conversationMessagesKey = queryKeys.chat.messages(message.conversationId);

  // 1. Update paginated messages cache with canonical deduplication
  queryClient.setQueryData<InfiniteData<PageResponse<MessageResponse>>>(
    conversationMessagesKey,
    (oldData) => {
      if (!oldData || !oldData.pages || oldData.pages.length === 0) {
        return oldData;
      }

      return prependUnique(oldData, message);
    },
  );

  // 2. Optimistically update lastMessageAt in conversation list cache if loaded
  queryClient.setQueryData<ConversationResponse[]>(
    queryKeys.chat.conversations(),
    (oldConversations) => {
      if (!oldConversations) return oldConversations;
      return oldConversations.map((conv) =>
        conv.id === message.conversationId
          ? { ...conv, lastMessageAt: message.createdAt }
          : conv,
      );
    },
  );

  // 3. Invalidate conversations list so ordering (newest lastMessageAt first) is refreshed
  queryClient.invalidateQueries({
    queryKey: queryKeys.chat.conversations(),
  });
}

/**
 * Handles incoming `MESSAGES_READ` WebSocket event.
 *
 * Marks outgoing messages as read (`isRead: true`) when the counterpart reads them.
 * Does not fabricate `readAt` (backend MessageResponse uses `isRead: boolean`).
 */
export function handleChatMessagesRead(
  queryClient: QueryClient,
  event: MessagesReadEvent,
): void {
  const { conversationId, readerId } = event;
  const conversationMessagesKey = queryKeys.chat.messages(conversationId);

  // 1. In-place update for cached message pages
  queryClient.setQueryData<InfiniteData<PageResponse<MessageResponse>>>(
    conversationMessagesKey,
    (oldData) => {
      if (!oldData || !oldData.pages || oldData.pages.length === 0) {
        return oldData;
      }

      let hasChanges = false;
      const newPages = oldData.pages.map((page) => {
        let pageChanged = false;
        const newContent = page.content.map((m) => {
          // If message was sent by other participant and currently unread, mark read
          if (m.senderId !== readerId && !m.isRead) {
            pageChanged = true;
            hasChanges = true;
            return { ...m, isRead: true };
          }
          return m;
        });

        return pageChanged ? { ...page, content: newContent } : page;
      });

      return hasChanges ? { ...oldData, pages: newPages } : oldData;
    },
  );

  // 2. Invalidate conversation messages to ensure server consistency
  queryClient.invalidateQueries({
    queryKey: conversationMessagesKey,
  });
}

/**
 * Resynchronizes chat queries after reconnection or foreground return.
 */
export function resyncChatQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.chat.conversations(),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.chat.all,
  });
}
