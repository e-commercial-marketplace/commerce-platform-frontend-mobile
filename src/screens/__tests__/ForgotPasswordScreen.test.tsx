/**
 * Unit tests for ForgotPasswordScreen.
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import * as authService from '../../services/authService';
import ForgotPasswordScreen from '../ForgotPasswordScreen';

jest.mock('../../services/authService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;

describe('ForgotPasswordScreen', () => {
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
  });

  it('renders correctly with title, input, and submit button', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Enter your account email to receive a 6-digit reset code.')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByRole('button', { name: 'Send Reset Code' })).toBeTruthy();
    expect(getByRole('button', { name: 'Return to Login' })).toBeTruthy();
  });

  it('validates empty email before submit', async () => {
    const { getByRole, getByText } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Send Reset Code' }));

    await waitFor(() => {
      expect(getByText('Email is required.')).toBeTruthy();
    });

    expect(mockedAuthService.forgotPassword).not.toHaveBeenCalled();
  });

  it('validates malformed email before submit', async () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'not-an-email');
    fireEvent.press(getByRole('button', { name: 'Send Reset Code' }));

    await waitFor(() => {
      expect(getByText('Enter a valid email address.')).toBeTruthy();
    });

    expect(mockedAuthService.forgotPassword).not.toHaveBeenCalled();
  });

  it('submits trimmed email, shows enumeration-safe alert, and navigates to ResetPassword', async () => {
    mockedAuthService.forgotPassword.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), '  user@marketplace.dev  ');
    fireEvent.press(getByRole('button', { name: 'Send Reset Code' }));

    await waitFor(() => {
      expect(mockedAuthService.forgotPassword).toHaveBeenCalledWith({
        email: 'user@marketplace.dev',
      });
      expect(mockedAuthService.forgotPassword).toHaveBeenCalledTimes(1);
    });

    // Enumeration-safe wording check
    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Code Sent',
      expect.stringContaining(
        'If an account is associated with this email, a 6-digit reset code has been sent.',
      ),
    );
    const alertMessage = alertSpy.mock.calls[0][1] as string;
    expect(alertMessage).not.toMatch(/account found|email exists|user does not exist/i);

    // Navigates to ResetPassword passing email
    expect(mockNavigate).toHaveBeenCalledWith('ResetPassword', {
      email: 'user@marketplace.dev',
    });
  });

  it('protects against duplicate submissions while in flight', async () => {
    let resolveRequest!: () => void;
    mockedAuthService.forgotPassword.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@marketplace.dev');
    const submitButton = getByRole('button', { name: 'Send Reset Code' });

    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    expect(mockedAuthService.forgotPassword).toHaveBeenCalledTimes(1);
    expect(getByText('Sending code...')).toBeTruthy();

    resolveRequest();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('ResetPassword', {
        email: 'user@marketplace.dev',
      });
    });
  });

  it('displays API/network error when request fails', async () => {
    mockedAuthService.forgotPassword.mockRejectedValueOnce(
      new ApiError('Unable to connect to the server. Please try again.', 'NETWORK_ERROR', null),
    );

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@marketplace.dev');
    fireEvent.press(getByRole('button', { name: 'Send Reset Code' }));

    await waitFor(() => {
      expect(getByText('Unable to connect to the server. Please try again.')).toBeTruthy();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to Login when "Return to Login" is tapped', () => {
    const { getByRole } = render(
      <ForgotPasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Return to Login' }));
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
