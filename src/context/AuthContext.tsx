/**
 * Shared authentication state backed by the real backend API.
 *
 * Flow: screens -> AuthContext -> authService -> axios client -> backend.
 * Tokens are persisted in SecureStore (with an in-memory mirror used by the
 * request interceptor). At startup the provider restores the stored session
 * and verifies it with GET /users/me; expired access tokens are rotated by the
 * API client, and an unrecoverable session triggers the handler that clears
 * the signed-in user.
 *
 * No mock login/register remains: authentication succeeds only when the
 * backend returns tokens. The cart cache is purged whenever the identity
 * changes (login, logout, switch account, expired session) so one customer's
 * cart can never leak into another session.
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setSessionExpiredHandler } from '../api/client';
import { toApiError } from '../api/errors';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import * as authService from '../services/authService';
import { clearTokens, getRefreshToken, loadTokens, saveTokens } from '../services/tokenStorage';
import type { ChangePasswordRequest, LoginRequest, RegisterInput, User } from '../types/auth';

export type AuthContextValue = {
  /** Currently signed-in user, or null while browsing as guest. */
  user: User | null;
  /** Derived convenience flag (user != null) for readability at call sites. */
  isAuthenticated: boolean;
  /** True while the stored session is being restored at app start. */
  isRestoring: boolean;
  /** Calls POST /auth/login; throws ApiError when the backend rejects it. */
  login: (credentials: LoginRequest) => Promise<void>;
  /** Calls POST /auth/register; throws ApiError (e.g. duplicate email). */
  register: (input: RegisterInput) => Promise<void>;
  /** Revokes the session on the backend and always clears it locally. */
  logout: () => Promise<void>;
  /** Changes password, rotates session tokens, and keeps the user signed in. */
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
};

/** Typed context; null until an AuthProvider mounts (consumers handle that). */
export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

/**
 * Drops every cached cart entry. Called before the identity changes in either
 * direction so a request for the next account can never render the previous
 * account's rows while its own fetch is in flight.
 */
function clearCartCache(): void {
  queryClient.removeQueries({ queryKey: queryKeys.cart.all });
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    // The API client calls this when the refresh token can no longer be used.
    setSessionExpiredHandler(() => {
      clearCartCache();
      setUser(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const tokens = await loadTokens();
        if (tokens == null) {
          return;
        }

        // The token belongs to a live session only if the backend accepts it;
        // the API client refreshes an expired access token transparently.
        const currentUser = await authService.getCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch (error) {
        // 401 (refresh also failed) or 404 (account gone) means the stored
        // session is unusable, so drop it. Network/timeout keeps the tokens so
        // a later start can retry — never show a fake signed-in state.
        const apiError = toApiError(error);
        if (apiError.status === 401 || apiError.status === 404) {
          await clearTokens();
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const auth = await authService.login(credentials);
    // Persist before exposing the user so every authenticated request that
    // follows immediately carries the new access token.
    await saveTokens({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
    // Never show a cart cached from a previous account.
    clearCartCache();
    setUser(auth.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const auth = await authService.register(input);
    await saveTokens({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
    clearCartCache();
    setUser(auth.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken != null) {
        await authService.logout(refreshToken);
      }
    } catch {
      // A failed logout call (network down, expired token, ...) must never
      // leave the user stuck signed in on the device.
    } finally {
      await clearTokens();
      clearCartCache();
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordRequest) => {
    const auth = await authService.changePassword(data);
    await saveTokens({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
    setUser(auth.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user != null,
      isRestoring,
      login,
      register,
      logout,
      changePassword,
    }),
    [user, isRestoring, login, register, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
