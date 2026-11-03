/**
 * Unit tests for LoginScreen.
 * Verifies email/password inputs, login submit, navigation to ForgotPassword,
 * and Vietnamese localized text.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import i18n from '../../i18n';
import { AppI18nProvider } from '../../i18n/I18nContext';
import LoginScreen from '../LoginScreen';

jest.mock('../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginScreen', () => {
  const mockLogin = jest.fn();
  const mockNavigate = jest.fn();
  const mockReplace = jest.fn();
  const mockGoBack = jest.fn();

  const navigation = {
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: mockLogin,
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    });
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders login form and "Forgot password?" link', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <LoginScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Your password')).toBeTruthy();
    expect(getByRole('button', { name: 'Forgot password?' })).toBeTruthy();
    expect(getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('navigates to ForgotPassword when "Forgot password?" is pressed', () => {
    const { getByRole } = render(
      <LoginScreen navigation={navigation} route={{} as never} />,
    );

    const forgotButton = getByRole('button', { name: 'Forgot password?' });
    fireEvent.press(forgotButton);

    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates empty email and password before submit', async () => {
    const { getByRole, getByText } = render(
      <LoginScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.press(getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(getByText('Email is required.')).toBeTruthy();
      expect(getByText('Password is required.')).toBeTruthy();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits valid credentials to authContext.login and navigates back', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole } = render(
      <LoginScreen navigation={navigation} route={{} as never} />,
    );

    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Your password'), 'Password123');

    fireEvent.press(getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password123',
      });
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('renders Vietnamese localized copy and validation errors when language is vi', async () => {
    await i18n.changeLanguage('vi');

    const { getByRole, getByText } = render(
      <AppI18nProvider initialLanguage="vi">
        <LoginScreen navigation={navigation} route={{} as never} />
      </AppI18nProvider>,
    );

    expect(getByText('Đăng nhập để tiếp tục.')).toBeTruthy();
    expect(getByText('Quên mật khẩu?')).toBeTruthy();
    expect(getByText('Chưa có tài khoản? ')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(getByText('Vui lòng nhập email.')).toBeTruthy();
      expect(getByText('Vui lòng nhập mật khẩu.')).toBeTruthy();
    });
  });
});
