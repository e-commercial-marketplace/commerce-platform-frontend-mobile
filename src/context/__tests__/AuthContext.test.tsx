/**
 * Unit tests for AuthContext session rotation and password change integration.
 */

import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { queryClient } from '../../api/queryClient';
import { useAuth } from '../../hooks/useAuth';
import * as authService from '../../services/authService';
import * as tokenStorage from '../../services/tokenStorage';
import type { AuthResponse, User, UserProfile } from '../../types/auth';
import { AuthProvider } from '../AuthContext';

jest.mock('../../services/authService');
jest.mock('../../services/tokenStorage');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const initialUser: UserProfile = {
  id: 'u-1',
  email: 'customer@marketplace.dev',
  name: 'Initial Customer',
  phone: null,
  address: null,
  role: 'CUSTOMER',
};

const updatedUser: User = {
  id: 'u-1',
  email: 'customer@marketplace.dev',
  name: 'Updated Customer',
  role: 'CUSTOMER',
};

const mockRotatedAuth: AuthResponse = {
  accessToken: 'new-access-token-123',
  refreshToken: 'new-refresh-token-123',
  expiresIn: 900,
  user: updatedUser,
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext - changePassword & session rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTokenStorage.loadTokens.mockResolvedValue({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
    });
    mockedAuthService.getCurrentUser.mockResolvedValue(initialUser);
  });

  it('successful changePassword stores new token pair, updates user, and keeps user signed in without clearing cart cache', async () => {
    mockedAuthService.changePassword.mockResolvedValue(mockRotatedAuth);
    mockedTokenStorage.saveTokens.mockResolvedValue();

    const removeQueriesSpy = jest.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isRestoring).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(initialUser);

    removeQueriesSpy.mockClear();

    await act(async () => {
      await result.current.changePassword({
        currentPassword: 'OldPassword@123',
        newPassword: 'NewPassword@123',
      });
    });

    // 1. Calls authService.changePassword with payload
    expect(mockedAuthService.changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPassword@123',
      newPassword: 'NewPassword@123',
    });

    // 2. Persists the NEW access token and NEW refresh token
    expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith({
      accessToken: 'new-access-token-123',
      refreshToken: 'new-refresh-token-123',
    });

    // 3. User remains authenticated with updated user profile
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(updatedUser);

    // 4. Cart and other query caches are NOT cleared on password change
    expect(removeQueriesSpy).not.toHaveBeenCalled();

    removeQueriesSpy.mockRestore();
  });

  it('failed changePassword does not overwrite tokens and leaves user logged in', async () => {
    const error = new ApiError('Current password is incorrect', 'VALIDATION_ERROR', 400);
    mockedAuthService.changePassword.mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isRestoring).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);

    mockedTokenStorage.saveTokens.mockClear();

    await act(async () => {
      await expect(
        result.current.changePassword({
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword@123',
        }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Current password is incorrect',
      });
    });

    // Tokens are NOT overwritten
    expect(mockedTokenStorage.saveTokens).not.toHaveBeenCalled();

    // User is NOT logged out
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(initialUser);
  });
});
