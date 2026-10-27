/**
 * Unit tests for ResetPasswordScreen.
 */

import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import * as authService from '../../services/authService';
import ResetPasswordScreen from '../ResetPasswordScreen';

jest.mock('../../services/authService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('ResetPasswordScreen', () => {
  const mockNavigate = jest.fn();
  const navigation = {
    navigate: mockNavigate,
  } as never;

  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.useRealTimers();
  });

  it('pre-fills email from route params and allows editing', () => {
    const route = { params: { email: 'preset@marketplace.dev' } } as never;

    const { getByDisplayValue, getByPlaceholderText } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    const emailInput = getByDisplayValue('preset@marketplace.dev');
    expect(emailInput).toBeTruthy();

    fireEvent.changeText(emailInput, 'edited@marketplace.dev');
    expect(getByDisplayValue('edited@marketplace.dev')).toBeTruthy();
  });

  it('restricts reset code to 6 digits, strips non-numeric input, and preserves leading zeros', () => {
    const route = { params: { email: 'user@marketplace.dev' } } as never;

    const { getByPlaceholderText, getByDisplayValue } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    const codeInput = getByPlaceholderText('123456');

    // Entering letters and symbols should be stripped
    fireEvent.changeText(codeInput, 'abc-00#0123999');

    // Stripped to digits only and sliced to 6: '000123'
    expect(getByDisplayValue('000123')).toBeTruthy();
  });

  it('validates required fields, code length, password length and confirm mismatch', async () => {
    const route = { params: { email: 'user@marketplace.dev' } } as never;

    const { getByPlaceholderText, getByRole, getByText, queryByText } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    // Empty submission
    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(getByText('Reset code is required.')).toBeTruthy();
      expect(getByText('New password is required.')).toBeTruthy();
      expect(getByText('Confirm your new password.')).toBeTruthy();
    });

    // Incomplete code (<6 digits)
    fireEvent.changeText(getByPlaceholderText('123456'), '12345');
    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(getByText('Reset code must be exactly 6 digits.')).toBeTruthy();
    });

    // Short password (<8 characters)
    fireEvent.changeText(getByPlaceholderText('123456'), '123456');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'short');
    fireEvent.changeText(getByPlaceholderText('Re-enter new password'), 'short');
    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
    });

    // Password mismatch
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'ValidPass1');
    fireEvent.changeText(getByPlaceholderText('Re-enter new password'), 'ValidPass2');
    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(getByText('Passwords do not match.')).toBeTruthy();
    });

    expect(mockedAuthService.resetPassword).not.toHaveBeenCalled();
  });

  it('submits valid reset payload without confirmPassword and navigates to Login on success', async () => {
    mockedAuthService.resetPassword.mockResolvedValueOnce(undefined);

    const route = { params: { email: '  user@marketplace.dev  ' } } as never;

    const { getByPlaceholderText, getByRole } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    fireEvent.changeText(getByPlaceholderText('123456'), '001234');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'NewValidPass123');
    fireEvent.changeText(getByPlaceholderText('Re-enter new password'), 'NewValidPass123');

    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(mockedAuthService.resetPassword).toHaveBeenCalledWith({
        email: 'user@marketplace.dev',
        code: '001234',
        newPassword: 'NewValidPass123',
      });
    });

    // Ensure confirmPassword was not sent
    const calledPayload = mockedAuthService.resetPassword.mock.calls[0][0] as Record<string, unknown>;
    expect(calledPayload).not.toHaveProperty('confirmPassword');

    expect(alertSpy).toHaveBeenCalledWith(
      'Password Reset Successful',
      'Your password has been reset successfully. Please log in with your new password.',
    );
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('displays 400 Invalid or expired reset code error from backend', async () => {
    mockedAuthService.resetPassword.mockRejectedValueOnce(
      new ApiError('Invalid or expired reset code', 'VALIDATION_ERROR', 400),
    );

    const route = { params: { email: 'user@marketplace.dev' } } as never;

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    fireEvent.changeText(getByPlaceholderText('123456'), '654321');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'NewValidPass123');
    fireEvent.changeText(getByPlaceholderText('Re-enter new password'), 'NewValidPass123');

    fireEvent.press(getByRole('button', { name: 'Reset Password' }));

    await waitFor(() => {
      expect(getByText('Invalid or expired reset code')).toBeTruthy();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('manages 60-second resend cooldown timer and executes resend', async () => {
    jest.useFakeTimers();

    const route = { params: { email: 'user@marketplace.dev' } } as never;

    const { getByRole, getByText, queryByText } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    // Initial countdown when email param is present
    expect(getByText('Resend code in 60s')).toBeTruthy();

    // Advance 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(getByText('Resend code in 30s')).toBeTruthy();

    // Advance another 30 seconds to reach 0
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(getByText('Resend Code')).toBeTruthy();

    // Tap Resend Code
    mockedAuthService.forgotPassword.mockResolvedValueOnce(undefined);

    const resendButton = getByRole('button', { name: 'Resend code' });
    await act(async () => {
      fireEvent.press(resendButton);
    });

    expect(mockedAuthService.forgotPassword).toHaveBeenCalledWith({
      email: 'user@marketplace.dev',
    });

    // Alert with enumeration/rate-limit safe wording
    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Code Sent',
      'If eligible, a new reset code has been sent.',
    );

    // Timer restarts at 60s
    expect(getByText('Resend code in 60s')).toBeTruthy();
  });

  it('cleans up timer on unmount without errors', () => {
    jest.useFakeTimers();

    const route = { params: { email: 'user@marketplace.dev' } } as never;

    const { unmount } = render(
      <ResetPasswordScreen navigation={navigation} route={route} />,
    );

    unmount();

    // Advancing timers should not throw any error or trigger updates
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(mockedAuthService.forgotPassword).not.toHaveBeenCalled();
  });
});
