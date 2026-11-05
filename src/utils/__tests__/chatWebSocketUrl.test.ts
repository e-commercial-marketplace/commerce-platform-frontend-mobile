import { getChatWebSocketUrl } from '../chatWebSocketUrl';

describe('getChatWebSocketUrl', () => {
  it('converts https URL with /api/v1 to wss URL with /ws/chat', () => {
    const input = 'https://commerce-platform-backend-k61l.onrender.com/api/v1';
    const result = getChatWebSocketUrl(input);
    expect(result).toBe('wss://commerce-platform-backend-k61l.onrender.com/ws/chat');
  });

  it('converts http URL with /api/v1 to ws URL with /ws/chat', () => {
    const input = 'http://localhost:8080/api/v1';
    const result = getChatWebSocketUrl(input);
    expect(result).toBe('ws://localhost:8080/ws/chat');
  });

  it('handles IP addresses and custom ports', () => {
    const input = 'http://192.168.1.100:8080/api/v1';
    const result = getChatWebSocketUrl(input);
    expect(result).toBe('ws://192.168.1.100:8080/ws/chat');
  });

  it('strips trailing slashes correctly', () => {
    const input = 'https://example.com/api/v1///';
    const result = getChatWebSocketUrl(input);
    expect(result).toBe('wss://example.com/ws/chat');
  });

  it('handles base URL without /api/v1 prefix gracefully', () => {
    const input = 'https://example.com';
    const result = getChatWebSocketUrl(input);
    expect(result).toBe('wss://example.com/ws/chat');
  });

  it('preserves existing wss or ws scheme if passed directly', () => {
    expect(getChatWebSocketUrl('wss://example.com/api/v1')).toBe('wss://example.com/ws/chat');
    expect(getChatWebSocketUrl('ws://localhost:8080')).toBe('ws://localhost:8080/ws/chat');
  });

  it('ensures resulting URL NEVER contains /api/v1', () => {
    const result = getChatWebSocketUrl('https://backend.test/api/v1');
    expect(result.includes('/api/v1')).toBe(false);
    expect(result.endsWith('/ws/chat')).toBe(true);
  });

  it('throws an error if input is empty or invalid', () => {
    expect(() => getChatWebSocketUrl('')).toThrow();
    expect(() => getChatWebSocketUrl(null as any)).toThrow();
  });
});
