/**
 * Native WebSocket client for real-time Human Customer–Seller Chat.
 *
 * Backend characteristics:
 * - Mount path: `/ws/chat` (without `/api/v1`)
 * - PUSH-ONLY: Server pushes events; client messages sent over WS are ignored.
 * - Handshake auth: `Authorization: Bearer <accessToken>` HTTP header.
 * - Roles: CUSTOMER and SELLER only.
 * - Outgoing chat messages are strictly sent via REST (chatService.sendMessage).
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import type {
  ChatConnectionState,
  ChatWebSocketEvent,
  MessageCreatedEvent,
  MessagesReadEvent,
} from '../types/chatApi';
import { getChatWebSocketUrl } from '../utils/chatWebSocketUrl';

export type WebSocketFactory = (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> },
) => WebSocket;

export type ChatWebSocketClientOptions = {
  url?: string;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  webSocketFactory?: WebSocketFactory;
};

export type EventListener = (event: ChatWebSocketEvent) => void;
export type StateListener = (state: ChatConnectionState) => void;
export type ResyncListener = () => void;

const DEFAULT_INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 30000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Native WebSocket manager for human chat real-time events.
 */
export class ChatWebSocketClient {
  private socket: WebSocket | null = null;
  private connectionState: ChatConnectionState = 'disconnected';
  private token: string | null = null;
  private isExplicitDisconnect = false;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentBackoffMs: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly backoffMultiplier: number;

  private readonly wsUrl: string;
  private readonly webSocketFactory: WebSocketFactory;

  private eventListeners = new Set<EventListener>();
  private stateListeners = new Set<StateListener>();
  private resyncListeners = new Set<ResyncListener>();

  private appStateSubscription: NativeEventSubscription | null = null;

  constructor(options?: ChatWebSocketClientOptions) {
    this.wsUrl = options?.url ?? getChatWebSocketUrl();
    this.initialBackoffMs = options?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = options?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.backoffMultiplier = options?.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER;
    this.currentBackoffMs = this.initialBackoffMs;

    this.webSocketFactory =
      options?.webSocketFactory ??
      ((url, protocols, wsOptions) => {
        // Native React Native WebSocket supports passing options as 3rd param with headers
        return new (global.WebSocket as any)(url, protocols, wsOptions);
      });

    // Listen to AppState transitions
    if (AppState && typeof AppState.addEventListener === 'function') {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange.bind(this),
      );
    }
  }

  /**
   * Connect to /ws/chat with the provided accessToken.
   * Disconnects any existing active socket first to guarantee a single connection.
   */
  public connect(token: string): void {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      this.disconnect();
      return;
    }

    // Clean up existing socket without marking it an explicit disconnect
    this.cleanupSocket();

    this.token = token.trim();
    this.isExplicitDisconnect = false;
    this.clearReconnectTimer();

    this.setConnectionState(
      this.connectionState === 'reconnecting' ? 'reconnecting' : 'connecting',
    );

    try {
      const socket = this.webSocketFactory(this.wsUrl, null, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      this.socket = socket;

      socket.onopen = () => {
        if (this.socket !== socket) return;
        this.currentBackoffMs = this.initialBackoffMs;
        this.setConnectionState('connected');
      };

      socket.onmessage = (event: WebSocketMessageEvent) => {
        if (this.socket !== socket) return;
        this.handleIncomingMessage(event.data);
      };

      socket.onerror = () => {
        if (this.socket !== socket) return;
        // Error will typically be followed by onclose
        if (!this.isExplicitDisconnect && this.connectionState !== 'connected') {
          this.setConnectionState('reconnecting');
        }
      };

      socket.onclose = (event: WebSocketCloseEvent) => {
        if (this.socket !== socket) return;
        this.socket = null;

        if (this.isExplicitDisconnect) {
          this.setConnectionState('disconnected');
          return;
        }

        // Unexpected disconnect: transition to reconnecting and schedule retry
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      };
    } catch {
      this.socket = null;
      if (!this.isExplicitDisconnect) {
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Disconnect the active socket cleanly (e.g. on logout, user change, or unmount).
   * Does NOT trigger automatic reconnect.
   */
  public disconnect(): void {
    this.isExplicitDisconnect = true;
    this.token = null;
    this.clearReconnectTimer();
    this.cleanupSocket();
    this.currentBackoffMs = this.initialBackoffMs;
    this.setConnectionState('disconnected');
  }

  /**
   * Gets the current connection state.
   */
  public getConnectionState(): ChatConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes.
   */
  public onConnectionStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to incoming server-pushed chat events.
   */
  public onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Subscribe to resync signals (e.g. on foreground return).
   */
  public onResync(listener: ResyncListener): () => void {
    this.resyncListeners.add(listener);
    return () => {
      this.resyncListeners.delete(listener);
    };
  }

  /**
   * Completely destroys this client instance.
   */
  public destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
    this.stateListeners.clear();
    this.resyncListeners.clear();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  // ---------- Internal Helpers ----------

  private setConnectionState(newState: ChatConnectionState): void {
    if (this.connectionState === newState) return;
    this.connectionState = newState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(newState);
      } catch {}
    });
  }

  private handleIncomingMessage(rawData: unknown): void {
    if (typeof rawData !== 'string') {
      return; // ignore binary or unexpected payload
    }

    try {
      const parsed = JSON.parse(rawData);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
        return; // ignore malformed payload safely
      }

      if (parsed.type === 'MESSAGE_CREATED') {
        const msg = parsed.message;
        if (
          msg &&
          typeof msg === 'object' &&
          typeof msg.id === 'string' &&
          typeof msg.conversationId === 'string'
        ) {
          this.dispatchEvent(parsed as MessageCreatedEvent);
        }
      } else if (parsed.type === 'MESSAGES_READ') {
        if (
          typeof parsed.conversationId === 'string' &&
          typeof parsed.readerId === 'string'
        ) {
          this.dispatchEvent(parsed as MessagesReadEvent);
        }
      }
      // Silently ignore any unknown event types per contract
    } catch {
      // Silently ignore invalid JSON
    }
  }

  private dispatchEvent(event: ChatWebSocketEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch {}
    });
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    if (this.isExplicitDisconnect || !this.token) {
      return;
    }

    const delay = this.currentBackoffMs;
    // Exponential backoff with ceiling
    this.currentBackoffMs = Math.min(
      this.currentBackoffMs * this.backoffMultiplier,
      this.maxBackoffMs,
    );

    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitDisconnect && this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanupSocket(): void {
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // Foreground: reset backoff, ensure connected if token exists, and notify resync
      if (this.token && !this.isExplicitDisconnect) {
        this.currentBackoffMs = this.initialBackoffMs;
        if (this.connectionState !== 'connected' && this.connectionState !== 'connecting') {
          this.connect(this.token);
        }
      }
      // Notify listeners to resync stale query data
      this.resyncListeners.forEach((listener) => {
        try {
          listener();
        } catch {}
      });
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Background: avoid aggressive reconnect loops while backgrounded
      this.clearReconnectTimer();
    }
  }
}

/** Singleton shared instance for application-wide chat events */
export const chatWebSocketClient = new ChatWebSocketClient();
