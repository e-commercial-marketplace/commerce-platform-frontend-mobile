/**
 * Token persistence backed by expo-secure-store.
 *
 * Tokens are kept in memory for synchronous reads (the request interceptor
 * needs the access token on every call) and mirrored to SecureStore so the
 * session survives an app restart. Passwords are never stored here, and
 * tokens are never logged.
 */

import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '../types/auth';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** Loads persisted tokens into memory; returns null when no session is stored. */
export async function loadTokens(): Promise<AuthTokens | null> {
  const [storedAccessToken, storedRefreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  // A half-written pair cannot be used: treat it as no session.
  if (storedAccessToken == null || storedRefreshToken == null) {
    if (storedAccessToken != null || storedRefreshToken != null) {
      await clearTokens();
    }
    return null;
  }

  accessToken = storedAccessToken;
  refreshToken = storedRefreshToken;
  return { accessToken, refreshToken };
}

/** Access token for authenticated requests; null when signed out. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Refresh token used for rotation and logout; null when signed out. */
export function getRefreshToken(): string | null {
  return refreshToken;
}

/** Persists a token pair (memory first, then SecureStore). */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;

  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

/** Removes both tokens from memory and SecureStore. */
export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;

  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
