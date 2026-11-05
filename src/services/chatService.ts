/**
 * Human Real-Time Customer–Seller Chat REST service.
 *
 * Thin wrapper over backend chat endpoints using shared `apiClient`
 * (inheriting baseURL /api/v1, Bearer token injection, and 401 refresh handling)
 * and `unwrapData` / `unwrapVoid` helpers.
 *
 * Contract verified against backend source:
 * - GET   /api/v1/conversations                  -> 200 ApiResponse<List<ConversationResponse>>
 * - POST  /api/v1/conversations                  -> 201/200 ApiResponse<ConversationResponse>
 * - GET   /api/v1/conversations/{id}/messages    -> 200 ApiResponse<PageResponse<MessageResponse>>
 * - POST  /api/v1/conversations/{id}/messages    -> 201 ApiResponse<MessageResponse>
 * - PATCH /api/v1/conversations/{id}/read        -> 200 ApiResponse<null>
 */

import { apiClient, unwrapData, unwrapVoid } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  ConversationResponse,
  MessageResponse,
  OpenConversationRequest,
  PageResponse,
  SendMessageRequest,
} from '../types/chatApi';

/** Default page size for message history loading (max 100). */
export const CHAT_MESSAGES_PAGE_SIZE = 20;

/**
 * GET /api/v1/conversations
 * List conversations owned by caller (CUSTOMER or SELLER).
 * Ordered by most recent lastMessageAt first.
 */
export async function listConversations(): Promise<ConversationResponse[]> {
  const response = await apiClient.get<ApiResponse<ConversationResponse[]>>('/conversations');
  return unwrapData(response);
}

/**
 * POST /api/v1/conversations
 * Idempotent get-or-create conversation for a customer/seller pair.
 * - Customer callers provide sellerId.
 * - Seller callers provide customerId.
 * - Optional productId / orderId.
 */
export async function openConversation(
  request: OpenConversationRequest,
): Promise<ConversationResponse> {
  const response = await apiClient.post<ApiResponse<ConversationResponse>>(
    '/conversations',
    request,
  );
  return unwrapData(response);
}

/**
 * GET /api/v1/conversations/{id}/messages
 * Load paginated message history for one conversation (newest first).
 * Page index is 0-based.
 */
export async function listMessages(
  conversationId: string,
  page = 0,
  size = CHAT_MESSAGES_PAGE_SIZE,
): Promise<PageResponse<MessageResponse>> {
  const encodedId = encodeURIComponent(conversationId);
  const response = await apiClient.get<ApiResponse<PageResponse<MessageResponse>>>(
    `/conversations/${encodedId}/messages`,
    {
      params: { page, size },
    },
  );
  return unwrapData(response);
}

/**
 * POST /api/v1/conversations/{id}/messages
 * Send a message within a conversation.
 *
 * Requires an explicit client-generated Idempotency-Key header (1 to 100 characters).
 * Retries with the same key return the stored message without duplicates.
 */
export async function sendMessage(
  conversationId: string,
  request: SendMessageRequest,
  idempotencyKey: string,
): Promise<MessageResponse> {
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    throw new Error('sendMessage requires an explicit, non-empty idempotencyKey');
  }
  const encodedId = encodeURIComponent(conversationId);
  const response = await apiClient.post<ApiResponse<MessageResponse>>(
    `/conversations/${encodedId}/messages`,
    request,
    {
      headers: {
        'Idempotency-Key': idempotencyKey.trim(),
      },
    },
  );
  return unwrapData(response);
}

/**
 * PATCH /api/v1/conversations/{id}/read
 * Mark all unread messages from the other participant as read.
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const encodedId = encodeURIComponent(conversationId);
  const response = await apiClient.patch<ApiResponse<null>>(
    `/conversations/${encodedId}/read`,
  );
  unwrapVoid(response);
}
