/**
 * AI Assistant API service - thin wrappers over backend AI endpoints.
 *
 * Uses the shared `apiClient` (inheriting base URL with /api/v1 prefix,
 * Bearer auth header, and 401 refresh handling) and `unwrapData` helper to convert
 * the backend's `ApiResponse` envelope into the data payload or throw a typed `ApiError`.
 *
 * Contract verified against the backend source:
 * - POST /api/v1/ai/ask                    -> 200 ApiResponse<AiProductSearchResponse>
 * - GET  /api/v1/ai/sessions               -> 200 ApiResponse<List<AiChatSessionResponse>>
 * - GET  /api/v1/ai/sessions/{id}/messages -> 200 ApiResponse<List<AiMessageResponse>>
 */

import { apiClient, unwrapData } from '../api/client';
import type { ApiResponse } from '../types/api';
import type {
  AiAskRequest,
  AiChatSessionResponse,
  AiMessageResponse,
  AiProductSearchResponse,
} from '../types/aiApi';

/**
 * POST /api/v1/ai/ask
 * Ask a shopping question or search for products/policies.
 * Guest callers send no sessionId (or null). Authenticated customers can send null
 * to start a new session or an existing sessionId to continue the conversation.
 */
export async function askAi(request: AiAskRequest): Promise<AiProductSearchResponse> {
  const response = await apiClient.post<ApiResponse<AiProductSearchResponse>>('/ai/ask', request);
  return unwrapData(response);
}

/**
 * GET /api/v1/ai/sessions
 * List persisted AI sessions owned by the authenticated customer (newest first).
 * Requires CUSTOMER role.
 */
export async function getAiSessions(): Promise<AiChatSessionResponse[]> {
  const response = await apiClient.get<ApiResponse<AiChatSessionResponse[]>>('/ai/sessions');
  return unwrapData(response);
}

/**
 * GET /api/v1/ai/sessions/{sessionId}/messages
 * Get all messages in a customer-owned AI session (oldest first).
 * Requires CUSTOMER role.
 */
export async function getAiSessionMessages(sessionId: string): Promise<AiMessageResponse[]> {
  const encodedSessionId = encodeURIComponent(sessionId);
  const response = await apiClient.get<ApiResponse<AiMessageResponse[]>>(
    `/ai/sessions/${encodedSessionId}/messages`,
  );
  return unwrapData(response);
}
