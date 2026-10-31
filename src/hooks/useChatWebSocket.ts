/**
 * TanStack Query + Auth integrated React hook for Human Chat real-time WebSocket.
 *
 * Responsibilities:
 * - Automatically connects when signed in as CUSTOMER or SELLER.
 * - Prevents connection and cleanly disconnects for GUEST or ADMIN.
 * - Bridges WebSocket events to React Query cache updates (with canonical deduplication).
 * - Bridges AppState resync signals to query invalidations.
 * - Exposes connectionState ('disconnected' | 'connecting' | 'connected' | 'reconnecting').
 * - Provides manual reconnect / disconnect triggers for UI components.
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from './useAuth';
import {
  chatWebSocketClient,
  ChatWebSocketClient,
} from '../services/chatWebSocketClient';
import { getAccessToken } from '../services/tokenStorage';
import type {
  ChatConnectionState,
  ChatWebSocketEvent,
} from '../types/chatApi';
import {
  handleChatMessageCreated,
  handleChatMessagesRead,
  resyncChatQueries,
} from '../utils/chatCacheUpdates';

export type UseChatWebSocketResult = {
  connectionState: ChatConnectionState;
  reconnect: () => void;
  disconnect: () => void;
};

/**
 * Hook for consuming real-time human chat events and connection state.
 */
export function useChatWebSocket(
  client: ChatWebSocketClient = chatWebSocketClient,
): UseChatWebSocketResult {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [connectionState, setConnectionState] = useState<ChatConnectionState>(() =>
    client.getConnectionState(),
  );

  // 1. Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = client.onConnectionStateChange((newState) => {
      setConnectionState(newState);
    });
    return unsubscribe;
  }, [client]);

  // 2. Subscribe to incoming events and update React Query cache
  useEffect(() => {
    const unsubscribeEvents = client.onEvent((event: ChatWebSocketEvent) => {
      if (event.type === 'MESSAGE_CREATED') {
        handleChatMessageCreated(queryClient, event);
      } else if (event.type === 'MESSAGES_READ') {
        handleChatMessagesRead(queryClient, event);
      }
    });

    const unsubscribeResync = client.onResync(() => {
      resyncChatQueries(queryClient);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeResync();
    };
  }, [client, queryClient]);

  // 3. Connect/Disconnect based on authentication and role
  useEffect(() => {
    const isEligibleRole = user?.role === 'CUSTOMER' || user?.role === 'SELLER';

    if (isAuthenticated && isEligibleRole) {
      const token = getAccessToken();
      if (token) {
        client.connect(token);
      }
    } else {
      // Guest or Admin or logged out: disconnect cleanly
      client.disconnect();
    }
  }, [client, isAuthenticated, user?.role]);

  const reconnect = () => {
    const token = getAccessToken();
    if (token && (user?.role === 'CUSTOMER' || user?.role === 'SELLER')) {
      client.connect(token);
    }
  };

  const disconnect = () => {
    client.disconnect();
  };

  return {
    connectionState,
    reconnect,
    disconnect,
  };
}
