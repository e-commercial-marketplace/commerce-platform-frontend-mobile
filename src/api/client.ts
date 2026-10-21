/**
 * Shared Axios client for the backend API.
 *
 * Verified against the backend source:
 * - every REST route lives under the versioned prefix /api/v1 (WebConfig);
 * - authenticated requests carry "Authorization: Bearer <accessToken>"
 *   (JwtAuthenticationFilter);
 * - a 401 is recovered by rotating the refresh token once
 *   (POST /auth/refresh) and retrying the original request;
 * - when rotation itself fails with 401, the stored tokens are cleared and
 *   the registered session-expired handler signs the UI out.
 *
 * Future Product/Order services reuse `apiClient` and inherit the auth header
 * and refresh behavior automatically.
 */

import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../services/tokenStorage';
import type { ApiResponse } from '../types/api';
import type { AuthResponse, AuthTokens, RefreshRequest } from '../types/auth';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import { ApiError, toApiError } from './errors';

/** Endpoints whose 401 is final (bad credentials, never token expiry). */
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let sessionExpiredHandler: (() => void) | null = null;

/** Registers the callback that resets the signed-in user (AuthContext). */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

/** No interceptors: the refresh call itself can never trigger a refresh. */
const bareClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken != null) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let rotationPromise: Promise<AuthTokens> | null = null;

/** Rotates the refresh token; concurrent 401s share one in-flight rotation. */
export function refreshSession(): Promise<AuthTokens> {
  if (rotationPromise == null) {
    rotationPromise = rotateRefreshToken().finally(() => {
      rotationPromise = null;
    });
  }
  return rotationPromise;
}

async function rotateRefreshToken(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken();
  if (refreshToken == null) {
    throw new ApiError(SESSION_EXPIRED_MESSAGE, 'AUTHENTICATION_REQUIRED', 401);
  }

  const body: RefreshRequest = { refreshToken };
  const response = await bareClient.post<ApiResponse<AuthResponse>>('/auth/refresh', body);
  const auth = unwrapData(response);
  const tokens: AuthTokens = { accessToken: auth.accessToken, refreshToken: auth.refreshToken };
  await saveTokens(tokens);
  return tokens;
}

function shouldSkipRefresh(url: string | undefined): boolean {
  if (url == null) {
    return false;
  }
  return NO_REFRESH_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw toApiError(error);
    }

    const config = error.config as RetryableRequestConfig | undefined;
    if (config == null || config._retried === true || shouldSkipRefresh(config.url)) {
      throw toApiError(error);
    }

    config._retried = true;

    try {
      const tokens = await refreshSession();
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return await apiClient.request(config);
    } catch (refreshError) {
      const apiError = toApiError(refreshError);
      if (apiError.status === 401) {
        // The refresh token is unusable: the session is over.
        await clearTokens();
        sessionExpiredHandler?.();
        throw new ApiError(SESSION_EXPIRED_MESSAGE, 'AUTHENTICATION_REQUIRED', 401);
      }
      // Network/timeout while refreshing: keep the stored tokens so a later
      // app start can retry restoration; this request still fails visibly.
      throw apiError;
    }
  },
);

/** Returns the envelope data or throws the backend error payload. */
export function unwrapData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const body = response.data;

  if (body.error != null) {
    throw new ApiError(
      body.error.message,
      body.error.code,
      response.status,
      body.error.fieldErrors,
    );
  }

  if (!body.success || body.data === undefined) {
    throw new ApiError(
      'The server returned an unexpected response. Please try again.',
      'UNEXPECTED_RESPONSE',
      response.status,
    );
  }

  return body.data;
}

/** For endpoints that answer with the envelope but no payload (logout). */
export function unwrapVoid(response: AxiosResponse<ApiResponse<null>>): void {
  const body = response.data;

  if (body.error != null) {
    throw new ApiError(
      body.error.message,
      body.error.code,
      response.status,
      body.error.fieldErrors,
    );
  }
}
