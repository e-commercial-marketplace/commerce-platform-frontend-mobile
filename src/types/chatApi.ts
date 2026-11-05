/**
 * Human Real-Time Customer–Seller Chat API types.
 *
 * Sourced directly from backend models and controllers:
 * - ConversationResponse.java
 * - MessageResponse.java
 * - ConversationCreateRequest.java
 * - MessageSendRequest.java
 * - PageResponse.java
 *
 * REST Endpoints:
 * - GET   /api/v1/conversations
 * - POST  /api/v1/conversations
 * - GET   /api/v1/conversations/{id}/messages
 * - POST  /api/v1/conversations/{id}/messages
 * - PATCH /api/v1/conversations/{id}/read
 */

/**
 * Paginated response wrapper.
 * Sourced directly from com.marketplace.common.response.PageResponse.java:
 * record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages)
 *
 * NOTE: Backend does NOT return `first` or `last` fields.
 */
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/**
 * Conversation between one customer and one seller.
 * Sourced from com.marketplace.dto.response.ConversationResponse.
 */
export type ConversationResponse = {
  id: string;
  customerId: string;
  sellerId: string;
  productId: string | null;
  orderId: string | null;
  createdAt: string;
  lastMessageAt: string | null;
};

/**
 * Request body for opening / getting-or-creating a conversation (POST /api/v1/conversations).
 * Sourced from com.marketplace.dto.request.ConversationCreateRequest.
 *
 * - When caller is CUSTOMER: sellerId is required (APPROVED seller).
 * - When caller is SELLER: customerId is required.
 * - productId / orderId are optional context.
 */
export type OpenConversationRequest = {
  sellerId?: string | null;
  customerId?: string | null;
  productId?: string | null;
  orderId?: string | null;
};

/**
 * Single chat message within a human conversation.
 * Sourced from com.marketplace.dto.response.MessageResponse.
 */
export type MessageResponse = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

/**
 * Request body for sending a message (POST /api/v1/conversations/{id}/messages).
 * Sourced from com.marketplace.dto.request.MessageSendRequest.
 *
 * Requires header `Idempotency-Key: <key>`.
 */
export type SendMessageRequest = {
  content?: string | null;
  imageUrl?: string | null;
};

/**
 * Paginated list of messages (newest first).
 */
export type PaginatedMessagesResponse = PageResponse<MessageResponse>;

/**
 * WebSocket event pushed by backend when a new message is saved.
 * Sourced from com.marketplace.websocket.MessageCreatedEvent.
 */
export type MessageCreatedEvent = {
  type: 'MESSAGE_CREATED';
  message: MessageResponse;
};

/**
 * WebSocket event pushed by backend when a conversation's messages are marked read.
 * Sourced from com.marketplace.websocket.MessagesReadEvent.
 */
export type MessagesReadEvent = {
  type: 'MESSAGES_READ';
  conversationId: string;
  readerId: string;
};

/**
 * Discriminated union of all server-pushed chat WebSocket events.
 */
export type ChatWebSocketEvent = MessageCreatedEvent | MessagesReadEvent;

/**
 * Explicit connection states exposed to UI and hooks.
 */
export type ChatConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
