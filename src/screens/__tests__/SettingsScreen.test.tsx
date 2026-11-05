/**
 * Unit tests for SettingsScreen.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import i18n from '../../i18n';
import { AppI18nProvider } from '../../i18n/I18nContext';
import { AppThemeProvider } from '../../theme';
import SettingsScreen from '../SettingsScreen';

jest.mock('../../services/preferenceStorage', () => ({
  getCachedLanguagePreference: jest.fn(() => 'en'),
  getCachedThemePreference: jest.fn(() => 'light'),
  loadStoredPreferences: jest.fn().mockResolvedValue({ language: 'en', themePreference: 'light' }),
  setStoredLanguagePreference: jest.fn().mockResolvedValue(undefined),
  setStoredThemePreference: jest.fn().mockResolvedValue(undefined),
}));

describe('SettingsScreen', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders settings screen with Theme, Language, and About cards in English', () => {
    const { getByTestId, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <SettingsScreen navigation={mockNavigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    expect(getByTestId('settings-screen')).toBeTruthy();
    expect(getByTestId('theme-selector')).toBeTruthy();
    expect(getByTestId('language-selector')).toBeTruthy();
    expect(getByText('Theme')).toBeTruthy();
    expect(getByText('Language')).toBeTruthy();
    expect(getByText('About Application')).toBeTruthy();
    expect(getByText('Version')).toBeTruthy();
  });

  it('switches language dynamically to Vietnamese and updates titles', async () => {
    const { getByTestId, getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider>
          <SettingsScreen navigation={mockNavigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    const viButton = getByTestId('language-btn-vi');
    fireEvent.press(viButton);

    await waitFor(() => {
      expect(getByText('Giao diện')).toBeTruthy();
      expect(getByText('Ngôn ngữ')).toBeTruthy();
      expect(getByText('Thông tin ứng dụng')).toBeTruthy();
      expect(getByText('Phiên bản')).toBeTruthy();
    });
  });

  it('allows selecting different theme modes (Light, Dark) and does not show System option', () => {
    const { getByTestId, queryByTestId } = render(
      <AppThemeProvider>
        <AppI18nProvider>
          <SettingsScreen navigation={mockNavigation} route={{} as never} />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    expect(queryByTestId('theme-btn-system')).toBeNull();

    const darkBtn = getByTestId('theme-btn-dark');
    fireEvent.press(darkBtn);
    expect(darkBtn.props.accessibilityState.selected).toBe(true);

    const lightBtn = getByTestId('theme-btn-light');
    fireEvent.press(lightBtn);
    expect(lightBtn.props.accessibilityState.selected).toBe(true);
  });
});
