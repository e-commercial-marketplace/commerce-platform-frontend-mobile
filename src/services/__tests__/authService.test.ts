/**
 * Unit tests for authService password management calls:
 * - forgotPassword
 * - resetPassword
 * - changePassword
 */

import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';
import type { AuthResponse } from '../../types/auth';
import { changePassword, forgotPassword, resetPassword } from '../authService';

jest.mock('../../api/client', () => {
  const actual = jest.requireActual('../../api/client');
  return {
    ...actual,
    apiClient: {
      post: jest.fn(),
      patch: jest.fn(),
    },
  };
});

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

const successVoidEnvelope = () => ({
  data: { success: true, data: null, error: null },
  status: 200,
});

const mockAuthResponse: AuthResponse = {
  accessToken: 'new-access-token-xyz',
  refreshToken: 'new-refresh-token-xyz',
  expiresIn: 900,
  user: {
    id: 'user-uuid-1',
    email: 'customer@marketplace.dev',
    name: 'Customer Name',
    role: 'CUSTOMER',
  },
};

const successDataEnvelope = (data: AuthResponse) => ({
  data: { success: true, data, error: null },
  status: 200,
});

describe('authService - password management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('forgotPassword', () => {
    it('calls POST /auth/password/forgot with email payload and unwraps void', async () => {
      mockedClient.post.mockResolvedValue(successVoidEnvelope() as never);

      await expect(
        forgotPassword({ email: 'customer@marketplace.dev' }),
      ).resolves.toBeUndefined();

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/password/forgot', {
        email: 'customer@marketplace.dev',
      });
    });

    it('preserves field validation error from backend', async () => {
      const validationError = new ApiError('Validation failed', 'VALIDATION_ERROR', 400, {
        email: 'must be a well-formed email address',
      });
      mockedClient.post.mockRejectedValue(validationError);

      await expect(forgotPassword({ email: 'invalid-email' })).rejects.toMatchObject({
        name: 'ApiError',
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Validation failed',
        fieldErrors: {
          email: 'must be a well-formed email address',
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('calls POST /auth/password/reset with exact email, code, newPassword payload (no confirmPassword)', async () => {
      mockedClient.post.mockResolvedValue(successVoidEnvelope() as never);

      const requestPayload = {
        email: 'customer@marketplace.dev',
        code: '123456',
        newPassword: 'NewPassword@123',
      };

      await expect(resetPassword(requestPayload)).resolves.toBeUndefined();

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/auth/password/reset',
        expect.objectContaining({
          email: 'customer@marketplace.dev',
          code: '123456',
          newPassword: 'NewPassword@123',
        }),
      );

      // Verify that confirmPassword is not in the payload
      const calledPayload = mockedClient.post.mock.calls[0][1] as Record<string, unknown>;
      expect(calledPayload).not.toHaveProperty('confirmPassword');
      expect(Object.keys(calledPayload).sort()).toEqual(['code', 'email', 'newPassword']);
    });

    it('preserves Invalid or expired reset code error', async () => {
      const invalidCodeError = new ApiError(
        'Invalid or expired reset code',
        'VALIDATION_ERROR',
        400,
      );
      mockedClient.post.mockRejectedValue(invalidCodeError);

      await expect(
        resetPassword({
          email: 'customer@marketplace.dev',
          code: '999999',
          newPassword: 'NewPassword@123',
        }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'Invalid or expired reset code',
      });
    });
  });

  describe('changePassword', () => {
    it('calls PATCH /users/me/password with exact currentPassword and newPassword payload and unwraps AuthResponse', async () => {
      mockedClient.patch.mockResolvedValue(successDataEnvelope(mockAuthResponse) as never);

      const requestPayload = {
        currentPassword: 'OldPassword@123',
        newPassword: 'NewPassword@123',
      };

      const result = await changePassword(requestPayload);

      expect(mockedClient.patch).toHaveBeenCalledWith(
        '/users/me/password',
        expect.objectContaining({
          currentPassword: 'OldPassword@123',
          newPassword: 'NewPassword@123',
        }),
      );

      const calledPayload = mockedClient.patch.mock.calls[0][1] as Record<string, unknown>;
      expect(calledPayload).not.toHaveProperty('confirmPassword');
      expect(Object.keys(calledPayload).sort()).toEqual(['currentPassword', 'newPassword']);

      expect(result).toEqual(mockAuthResponse);
      expect(result.accessToken).toBe('new-access-token-xyz');
      expect(result.refreshToken).toBe('new-refresh-token-xyz');
    });

    it('preserves 400 Current password is incorrect error', async () => {
      const wrongPwError = new ApiError(
        'Current password is incorrect',
        'VALIDATION_ERROR',
        400,
      );
      mockedClient.patch.mockRejectedValue(wrongPwError);

      await expect(
        changePassword({
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

    it('preserves 400 New password must be different from the current password error', async () => {
      const samePwError = new ApiError(
        'New password must be different from the current password',
        'VALIDATION_ERROR',
        400,
      );
      mockedClient.patch.mockRejectedValue(samePwError);

      await expect(
        changePassword({
          currentPassword: 'SamePassword@123',
          newPassword: 'SamePassword@123',
        }),
      ).rejects.toMatchObject({
        name: 'ApiError',
        code: 'VALIDATION_ERROR',
        status: 400,
        message: 'New password must be different from the current password',
      });
    });
  });
});
