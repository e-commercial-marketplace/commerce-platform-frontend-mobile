/**
 * WebSocket URL derivation for Human Customer–Seller Chat.
 *
 * Backend WebSocket endpoint:
 *   GET /ws/chat (HTTP 101 Upgrade)
 *
 * NOTE: The backend mounts WebSocket at `/ws/chat` directly, NOT under `/api/v1`.
 * This utility converts the configured REST base URL into the matching WebSocket URL.
 */

import { API_BASE_URL } from '../api/config';

/**
 * Derives the WebSocket URL for /ws/chat from the REST API base URL.
 *
 * Examples:
 * - 'https://example.com/api/v1'   -> 'wss://example.com/ws/chat'
 * - 'http://localhost:8080/api/v1' -> 'ws://localhost:8080/ws/chat'
 * - 'http://192.168.1.5:8080'      -> 'ws://192.168.1.5:8080/ws/chat'
 * - 'https://render.com/api/v1/'   -> 'wss://render.com/ws/chat'
 */
export function getChatWebSocketUrl(apiBaseUrl: string = API_BASE_URL): string {
  if (!apiBaseUrl || typeof apiBaseUrl !== 'string') {
    throw new Error('getChatWebSocketUrl: apiBaseUrl must be a non-empty string');
  }

  // Trim whitespace and remove trailing slashes
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '');

  // Strip trailing /api/v1 or /api/v* prefix if present
  const withoutApiPrefix = trimmed.replace(/\/api\/v\d+$/i, '');

  // Convert scheme: https -> wss, http -> ws
  if (/^https:\/\//i.test(withoutApiPrefix)) {
    return withoutApiPrefix.replace(/^https:\/\//i, 'wss://') + '/ws/chat';
  }

  if (/^http:\/\//i.test(withoutApiPrefix)) {
    return withoutApiPrefix.replace(/^http:\/\//i, 'ws://') + '/ws/chat';
  }

  if (/^wss:\/\//i.test(withoutApiPrefix) || /^ws:\/\//i.test(withoutApiPrefix)) {
    return withoutApiPrefix + '/ws/chat';
  }

  // Fallback for scheme-less URLs
  return `wss://${withoutApiPrefix.replace(/^\/+/, '')}/ws/chat`;
}
