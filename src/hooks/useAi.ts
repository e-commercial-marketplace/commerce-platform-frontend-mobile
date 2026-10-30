/**
 * TanStack Query hooks for the AI Assistant feature.
 *
 * Hooks:
 * - `useAskAi`: mutation hook to send questions to POST /api/v1/ai/ask.
 * - `useAiSessions`: query hook to fetch customer's chat sessions (GET /api/v1/ai/sessions).
 * - `useAiSessionMessages`: query hook to fetch messages for an existing session (GET /api/v1/ai/sessions/{id}/messages).
 */

import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { askAi, getAiSessionMessages, getAiSessions } from '../services/aiService';
import type {
  AiAskRequest,
  AiChatSessionResponse,
  AiMessageResponse,
  AiProductSearchResponse,
} from '../types/aiApi';

export type UseAiSessionsOptions = {
  enabled?: boolean;
};

export type UseAiSessionMessagesOptions = {
  enabled?: boolean;
};

/**
 * Mutation hook for asking AI questions.
 * Standard TanStack mutation state (isPending, isSuccess, isError, error, data).
 * Does not cache the POST request in the query cache as a normal query.
 */
export function useAskAi() {
  return useMutation<AiProductSearchResponse, Error, AiAskRequest>({
    mutationFn: (request: AiAskRequest) => askAi(request),
  });
}

/**
 * Query hook for fetching authenticated customer's AI chat sessions.
 * Can be disabled for guests or non-customer roles via `enabled: false`.
 */
export function useAiSessions(options?: UseAiSessionsOptions | boolean) {
  const isEnabled = typeof options === 'boolean' ? options : options?.enabled ?? true;

  return useQuery<AiChatSessionResponse[]>({
    queryKey: queryKeys.ai.sessions(),
    queryFn: getAiSessions,
    enabled: isEnabled,
  });
}

/**
 * Query hook for fetching messages of a specific session.
 * Automatically disabled if `sessionId` is missing or empty.
 * Can be explicitly disabled for guests or non-customer roles via `enabled: false`.
 */
export function useAiSessionMessages(
  sessionId?: string | null,
  options?: UseAiSessionMessagesOptions | boolean,
) {
  const isEnabled = typeof options === 'boolean' ? options : options?.enabled ?? true;
  const hasValidSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0;

  return useQuery<AiMessageResponse[]>({
    queryKey: queryKeys.ai.sessionMessages(sessionId ?? ''),
    queryFn: () => getAiSessionMessages(sessionId!),
    enabled: isEnabled && hasValidSessionId,
  });
}
