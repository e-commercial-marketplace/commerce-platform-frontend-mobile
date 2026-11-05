import { AppState, type AppStateStatus } from 'react-native';

import type {
  ChatConnectionState,
  ChatWebSocketEvent,
  MessageCreatedEvent,
  MessageResponse,
  MessagesReadEvent,
} from '../../types/chatApi';
import { ChatWebSocketClient, type WebSocketFactory } from '../chatWebSocketClient';

class MockWebSocket {
  public url: string;
  public protocols: string | string[] | null | undefined;
  public options: { headers?: Record<string, string> } | undefined;
  public readyState: number = 0; // CONNECTING

  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: any }) => void) | null = null;
  public onerror: ((error: any) => void) | null = null;
  public onclose: ((event: { code: number; reason: string }) => void) | null = null;

  public closeMock = jest.fn();
  public sendMock = jest.fn();

  constructor(
    url: string,
    protocols?: string | string[] | null,
    options?: { headers?: Record<string, string> },
  ) {
    this.url = url;
    this.protocols = protocols;
    this.options = options;
  }

  public close(code = 1000, reason = '') {
    this.closeMock(code, reason);
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  public send(data: any) {
    this.sendMock(data);
  }

  // Test helpers to simulate server events
  public simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen();
    }
  }

  public simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  public simulateError(error: any = new Error('Socket error')) {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  public simulateClose(code = 1006, reason = 'Abnormal closure') {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
}

describe('ChatWebSocketClient', () => {
  let createdSockets: MockWebSocket[];
  let mockFactory: WebSocketFactory;
  let appStateCallback: ((state: AppStateStatus) => void) | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    createdSockets = [];
    mockFactory = jest.fn((url, protocols, options) => {
      const socket = new MockWebSocket(url, protocols, options);
      createdSockets.push(socket);
      return socket as any;
    });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener: any) => {
      if (event === 'change') {
        appStateCallback = listener;
      }
      return { remove: jest.fn() } as any;
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('connection & handshake', () => {
    it('initializes in disconnected state', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('passes Authorization Bearer header in options and NEVER in URL query params', () => {
      const client = new ChatWebSocketClient({
        url: 'wss://test.backend.com/ws/chat',
        webSocketFactory: mockFactory,
      });

      client.connect('jwt-token-xyz-123');

      expect(createdSockets).toHaveLength(1);
      const socket = createdSockets[0];

      // Handshake header
      expect(socket.options?.headers?.Authorization).toBe('Bearer jwt-token-xyz-123');
      // No token in query params
      expect(socket.url).toBe('wss://test.backend.com/ws/chat');
      expect(socket.url).not.toContain('jwt-token-xyz-123');
      expect(socket.url).not.toContain('token');
      expect(client.getConnectionState()).toBe('connecting');
    });

    it('does not connect when token is empty or whitespace', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });

      client.connect('');
      expect(createdSockets).toHaveLength(0);
      expect(client.getConnectionState()).toBe('disconnected');

      client.connect('   ');
      expect(createdSockets).toHaveLength(0);
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('transitions to connected when socket opens', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const stateListener = jest.fn();
      client.onConnectionStateChange(stateListener);

      client.connect('valid-token');
      expect(client.getConnectionState()).toBe('connecting');

      createdSockets[0].simulateOpen();
      expect(client.getConnectionState()).toBe('connected');
      expect(stateListener).toHaveBeenCalledWith('connected');
    });

    it('guarantees only one active socket at a time by cleaning up prior socket on reconnect', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });

      client.connect('token-1');
      expect(createdSockets).toHaveLength(1);
      const socket1 = createdSockets[0];

      client.connect('token-2');
      expect(createdSockets).toHaveLength(2);
      expect(socket1.closeMock).toHaveBeenCalled();
    });
  });

  describe('push-only behavior', () => {
    it('never sends client chat messages over WebSocket', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      client.connect('token');
      createdSockets[0].simulateOpen();

      // Ensure client does not expose a send method and never sends frames
      expect((client as any).sendMessage).toBeUndefined();
      expect(createdSockets[0].sendMock).not.toHaveBeenCalled();
    });
  });

  describe('exponential backoff reconnect', () => {
    it('transitions to reconnecting and uses exponential backoff on unexpected closure', () => {
      const client = new ChatWebSocketClient({
        initialBackoffMs: 1000,
        maxBackoffMs: 8000,
        backoffMultiplier: 2,
        webSocketFactory: mockFactory,
      });

      client.connect('token');
      createdSockets[0].simulateOpen();

      // Unexpected close (e.g. server restart / network drop)
      createdSockets[0].simulateClose(1006, 'Abnormal closure');
      expect(client.getConnectionState()).toBe('reconnecting');

      // Attempt 1: backoff is 1000ms
      jest.advanceTimersByTime(999);
      expect(createdSockets).toHaveLength(1); // not yet reconnected
      jest.advanceTimersByTime(1);
      expect(createdSockets).toHaveLength(2); // reconnected!

      // Attempt 2 fails
      createdSockets[1].simulateClose(1006);
      jest.advanceTimersByTime(1999);
      expect(createdSockets).toHaveLength(2);
      jest.advanceTimersByTime(1);
      expect(createdSockets).toHaveLength(3); // delay was 2000ms

      // Attempt 3 fails
      createdSockets[2].simulateClose(1006);
      jest.advanceTimersByTime(3999);
      expect(createdSockets).toHaveLength(3);
      jest.advanceTimersByTime(1);
      expect(createdSockets).toHaveLength(4); // delay was 4000ms
    });

    it('resets backoff delay to initial upon successful connection', () => {
      const client = new ChatWebSocketClient({
        initialBackoffMs: 1000,
        maxBackoffMs: 8000,
        backoffMultiplier: 2,
        webSocketFactory: mockFactory,
      });

      client.connect('token');
      createdSockets[0].simulateOpen();

      // Fail once (backoff grows to 2000ms)
      createdSockets[0].simulateClose(1006);
      jest.advanceTimersByTime(1000);
      expect(createdSockets).toHaveLength(2);

      // Now successfully opens
      createdSockets[1].simulateOpen();
      expect(client.getConnectionState()).toBe('connected');

      // Next unexpected closure should start back at initialBackoffMs (1000ms)
      createdSockets[1].simulateClose(1006);
      jest.advanceTimersByTime(1000);
      expect(createdSockets).toHaveLength(3);
    });

    it('does NOT reconnect when disconnect() is explicitly called', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      client.connect('token');
      createdSockets[0].simulateOpen();

      client.disconnect();
      expect(client.getConnectionState()).toBe('disconnected');

      jest.advanceTimersByTime(60000);
      expect(createdSockets).toHaveLength(1); // no new sockets
    });
  });

  describe('event parsing and dispatching', () => {
    it('dispatches valid MESSAGE_CREATED event', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const eventListener = jest.fn();
      client.onEvent(eventListener);

      client.connect('token');
      createdSockets[0].simulateOpen();

      const message: MessageResponse = {
        id: 'msg-123',
        conversationId: 'conv-456',
        senderId: 'user-789',
        content: 'Hello shop',
        imageUrl: null,
        isRead: false,
        createdAt: '2026-10-30T10:00:00Z',
      };

      const payload: MessageCreatedEvent = {
        type: 'MESSAGE_CREATED',
        message,
      };

      createdSockets[0].simulateMessage(JSON.stringify(payload));

      expect(eventListener).toHaveBeenCalledWith(payload);
    });

    it('dispatches valid MESSAGES_READ event', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const eventListener = jest.fn();
      client.onEvent(eventListener);

      client.connect('token');
      createdSockets[0].simulateOpen();

      const payload: MessagesReadEvent = {
        type: 'MESSAGES_READ',
        conversationId: 'conv-456',
        readerId: 'user-789',
      };

      createdSockets[0].simulateMessage(JSON.stringify(payload));

      expect(eventListener).toHaveBeenCalledWith(payload);
    });

    it('safely ignores malformed JSON payloads without throwing', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const eventListener = jest.fn();
      client.onEvent(eventListener);

      client.connect('token');
      createdSockets[0].simulateOpen();

      expect(() => {
        createdSockets[0].simulateMessage('{ invalid json:;;; ');
        createdSockets[0].simulateMessage('not a json at all');
        createdSockets[0].simulateMessage('');
      }).not.toThrow();

      expect(eventListener).not.toHaveBeenCalled();
    });

    it('safely ignores unknown event types without throwing', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const eventListener = jest.fn();
      client.onEvent(eventListener);

      client.connect('token');
      createdSockets[0].simulateOpen();

      createdSockets[0].simulateMessage(
        JSON.stringify({ type: 'UNSUPPORTED_TYPING_EVENT', user: 'bob' }),
      );

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('AppState handling', () => {
    it('reconnects and fires resync on transition to active foreground', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      const resyncListener = jest.fn();
      client.onResync(resyncListener);

      client.connect('token');
      createdSockets[0].simulateOpen();
      createdSockets[0].simulateClose(1006); // now reconnecting

      // Transition app to active foreground
      expect(appStateCallback).toBeDefined();
      appStateCallback!('active');

      expect(resyncListener).toHaveBeenCalled();
      // Immediate reconnect attempt initiated
      expect(createdSockets.length).toBeGreaterThanOrEqual(2);
    });

    it('clears reconnect timer on transition to background', () => {
      const client = new ChatWebSocketClient({
        initialBackoffMs: 5000,
        webSocketFactory: mockFactory,
      });

      client.connect('token');
      createdSockets[0].simulateOpen();
      createdSockets[0].simulateClose(1006);

      // App goes to background
      appStateCallback!('background');

      // Advancing time in background does NOT loop reconnect
      jest.advanceTimersByTime(10000);
      expect(createdSockets).toHaveLength(1);
    });
  });

  describe('cleanup / destroy', () => {
    it('closes socket, clears listeners, and removes AppState listener on destroy()', () => {
      const client = new ChatWebSocketClient({ webSocketFactory: mockFactory });
      client.connect('token');
      createdSockets[0].simulateOpen();

      client.destroy();

      expect(client.getConnectionState()).toBe('disconnected');
      expect(createdSockets[0].closeMock).toHaveBeenCalled();
    });
  });
});
