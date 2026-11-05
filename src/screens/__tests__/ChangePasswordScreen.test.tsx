/**
 * Unit tests for ChangePasswordScreen.
 * Covers:
 * - Rendering input fields with show/hide password toggles
 * - Form validation (empty fields, min length, max length, matching current, mismatch confirm)
 * - Space/symbol preservation without trimming
 * - Success submission delegating to AuthContext.changePassword
 * - Success alert and navigation.goBack()
 * - Duplicate submission prevention
 * - Error mapping for 400 incorrect current password, 400 same password, and network errors
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { useAuth } from '../../hooks/useAuth';
import ChangePasswordScreen from '../ChangePasswordScreen';

jest.mock('../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('ChangePasswordScreen', () => {
  const mockChangePassword = jest.fn();
  const mockGoBack = jest.fn();
  const navigation = {
    goBack: mockGoBack,
  } as never;

  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'user@marketplace.dev',
        name: 'Dev User',
        role: 'CUSTOMER',
      },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: mockChangePassword,
      updateUserName: jest.fn(),
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders all 3 password fields with Show/Hide toggles and submit button', () => {
    const { getByPlaceholderText, getByRole, getAllByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByPlaceholderText('Your current password')).toBeTruthy();
    expect(getByPlaceholderText('From 8 to 72 characters')).toBeTruthy();
    expect(getByPlaceholderText('Re-enter your new password')).toBeTruthy();

    const showToggles = getAllByText('Show');
    expect(showToggles.length).toBe(3);

    expect(getByRole('button', { name: 'Change Password' })).toBeTruthy();
  });

  it('validates empty fields on submit', async () => {
    const { getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Current password is required.')).toBeTruthy();
      expect(getByText('New password is required.')).toBeTruthy();
      expect(getByText('Confirm your new password.')).toBeTruthy();
    });

    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates new password length between 8 and 72 characters', async () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'OldPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'short');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'short');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();

    // Test > 72 chars
    const overlyLong = 'a'.repeat(73);
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), overlyLong);
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), overlyLong);

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Password must be at most 72 characters.')).toBeTruthy();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates new password must be different from current password', async () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'SamePassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'SamePassword123!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'SamePassword123!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('New password must be different from current password.')).toBeTruthy();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('validates confirm password mismatch', async () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'CurrentPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewPassword123!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'MismatchPassword123!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Passwords do not match.')).toBeTruthy();
    });
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('preserves spaces and symbols without trimming', async () => {
    mockChangePassword.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    const currentWithSpace = '  old pass with spaces!  ';
    const newWithSpace = '  new pass with spaces!  ';

    fireEvent.changeText(getByPlaceholderText('Your current password'), currentWithSpace);
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), newWithSpace);
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), newWithSpace);

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: currentWithSpace,
        newPassword: newWithSpace,
      });
    });
  });

  it('submits valid passwords, triggers AuthContext.changePassword, alerts success, and navigates back', async () => {
    mockChangePassword.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'CurrentPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewBrandPassword456!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'NewBrandPassword456!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewBrandPassword456!',
      });
      expect(alertSpy).toHaveBeenCalledWith('Success', 'Password changed successfully.');
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('prevents duplicate submissions while in flight', async () => {
    let resolveChange!: () => void;
    mockChangePassword.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveChange = resolve;
      }),
    );

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'CurrentPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewBrandPassword456!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'NewBrandPassword456!');

    const submitButton = getByRole('button', { name: 'Change Password' });
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    expect(mockChangePassword).toHaveBeenCalledTimes(1);
    expect(getByText('Changing password...')).toBeTruthy();

    resolveChange();
    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('handles backend 400 "Current password is incorrect" error without crashing or navigating away', async () => {
    mockChangePassword.mockRejectedValueOnce(
      new ApiError('Current password is incorrect', 'VALIDATION_ERROR', null),
    );

    const { getByPlaceholderText, getByRole, getAllByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'WrongCurrentPassword!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewBrandPassword456!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'NewBrandPassword456!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      const errorMatches = getAllByText('Current password is incorrect');
      expect(errorMatches.length).toBeGreaterThanOrEqual(1);
    });

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('handles backend field errors appropriately', async () => {
    mockChangePassword.mockRejectedValueOnce(
      new ApiError('Validation failed', 'VALIDATION_ERROR', 400, {
        newPassword: 'Password is too weak',
      }),
    );

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'CurrentPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewBrandPassword456!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'NewBrandPassword456!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Password is too weak')).toBeTruthy();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('handles network error and allows user to retry', async () => {
    mockChangePassword.mockRejectedValueOnce(
      new ApiError('Unable to connect to the server. Please try again.', 'NETWORK_ERROR', null),
    );

    const { getByPlaceholderText, getByRole, getByText } = render(
      <ChangePasswordScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('Your current password'), 'CurrentPassword123!');
    fireEvent.changeText(getByPlaceholderText('From 8 to 72 characters'), 'NewBrandPassword456!');
    fireEvent.changeText(getByPlaceholderText('Re-enter your new password'), 'NewBrandPassword456!');

    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(getByText('Unable to connect to the server. Please try again.')).toBeTruthy();
    });

    // Retry successfully
    mockChangePassword.mockResolvedValueOnce(undefined);
    fireEvent.press(getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledTimes(2);
      expect(alertSpy).toHaveBeenCalledWith('Success', 'Password changed successfully.');
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
