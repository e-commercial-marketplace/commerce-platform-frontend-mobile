/**
 * Utility for generating client-side idempotency keys for chat message delivery.
 *
 * Sourced directly from backend ChatController / ChatServiceImpl requirements:
 * - Header: Idempotency-Key
 * - Length constraint: 1 to 100 characters.
 * - Format: Alphanumeric with safe delimiters.
 * - Idempotency contract:
 *   When user retries a failed message, it MUST reuse the exact same idempotencyKey.
 *   Only a brand new message composition generates a new idempotencyKey.
 */

let counter = 0;

export function generateClientMessageKey(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  counter = (counter + 1) % 10000;
  const key = `msg_${now}_${rand}_${counter}`;
  // Ensure strict adherence to 100 chars limit
  return key.slice(0, 100);
}
