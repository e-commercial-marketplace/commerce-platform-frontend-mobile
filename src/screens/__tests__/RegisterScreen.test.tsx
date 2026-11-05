/**
 * Unit tests for RegisterScreen.
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import i18n from '../../i18n';
import { AppI18nProvider } from '../../i18n/I18nContext';
import { AppThemeProvider } from '../../theme';
import RegisterScreen from '../RegisterScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../services/preferenceStorage', () => ({
  getCachedLanguagePreference: jest.fn(() => 'en'),
  getCachedThemePreference: jest.fn(() => 'system'),
  loadStoredPreferences: jest.fn().mockResolvedValue({ language: 'en', themePreference: 'system' }),
  setStoredLanguagePreference: jest.fn().mockResolvedValue(undefined),
  setStoredThemePreference: jest.fn().mockResolvedValue(undefined),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('RegisterScreen', () => {
  const mockRegister = jest.fn();
  const mockGoBack = jest.fn();
  const mockReplace = jest.fn();
  const navigation = {
    goBack: mockGoBack,
    replace: mockReplace,
  } as never;

  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: mockRegister,
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders registration form with all inputs and submit button', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <RegisterScreen navigation={navigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    expect(getByText('Create an account to get started.')).toBeTruthy();
    expect(getByPlaceholderText('Nguyen Van A')).toBeTruthy();
    expect(getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(getByPlaceholderText('At least 8 characters')).toBeTruthy();
    expect(getByPlaceholderText('Re-enter your password')).toBeTruthy();
    expect(getByRole('button', { name: 'Register' })).toBeTruthy();
    expect(getByRole('button', { name: 'Log in' })).toBeTruthy();
  });

  it('validates empty fields and confirms password mismatch before submit', async () => {
    const { getByPlaceholderText, getByRole, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <RegisterScreen navigation={navigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    fireEvent.press(getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(getByText('Full name is required.')).toBeTruthy();
      expect(getByText('Email is required.')).toBeTruthy();
      expect(getByText('Password is required.')).toBeTruthy();
    });

    // Mismatched passwords
    fireEvent.changeText(getByPlaceholderText('Nguyen Van A'), 'Dev User');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'user@test.dev');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Re-enter your password'), 'Different123');

    fireEvent.press(getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(getByText('Passwords do not match.')).toBeTruthy();
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits valid CUSTOMER registration and navigates back', async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <RegisterScreen navigation={navigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    fireEvent.changeText(getByPlaceholderText('Nguyen Van A'), 'John Doe');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'john@example.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Re-enter your password'), 'Password123');

    fireEvent.press(getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        role: 'CUSTOMER',
      });
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('allows selecting SELLER role and displays approval alert upon registration', async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByRole, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <RegisterScreen navigation={navigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    fireEvent.press(getByText('Seller'));
    fireEvent.changeText(getByPlaceholderText('Nguyen Van A'), 'Seller Store');
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'seller@example.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'Password123');
    fireEvent.changeText(getByPlaceholderText('Re-enter your password'), 'Password123');

    fireEvent.press(getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Seller Store',
        email: 'seller@example.com',
        password: 'Password123',
        role: 'SELLER',
      });
      expect(alertSpy).toHaveBeenCalledWith(
        'Seller account created',
        'Seller account created. Your seller access is pending admin approval.',
      );
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('renders localized Vietnamese copy and validation errors when language is vi', async () => {
    await i18n.changeLanguage('vi');

    const { getByRole, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="vi">
          <RegisterScreen navigation={navigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    expect(getByText('Tạo tài khoản để bắt đầu.')).toBeTruthy();
    expect(getByText('Khách hàng')).toBeTruthy();
    expect(getByText('Người bán')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => {
      expect(getByText('Vui lòng nhập họ và tên.')).toBeTruthy();
      expect(getByText('Vui lòng nhập email.')).toBeTruthy();
      expect(getByText('Vui lòng nhập mật khẩu.')).toBeTruthy();
    });
  });
});
