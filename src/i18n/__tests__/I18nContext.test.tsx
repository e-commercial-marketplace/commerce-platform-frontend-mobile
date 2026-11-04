import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import * as preferenceStorage from '../../services/preferenceStorage';
import i18n from '../index';
import { AppI18nProvider, useAppLanguage } from '../I18nContext';

jest.mock('../../services/preferenceStorage');

const mockedPreferenceStorage = preferenceStorage as jest.Mocked<typeof preferenceStorage>;

describe('I18nContext', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockedPreferenceStorage.loadStoredPreferences.mockResolvedValue({
      themePreference: 'light',
      language: 'vi',
    });
    mockedPreferenceStorage.getCachedLanguagePreference.mockReturnValue('vi');
    mockedPreferenceStorage.setStoredLanguagePreference.mockResolvedValue();
    await i18n.changeLanguage('vi');
  });

  describe('AppI18nProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppI18nProvider>{children}</AppI18nProvider>
    );

    it('defaults to Vietnamese language', () => {
      const { result } = renderHook(() => useAppLanguage(), { wrapper });

      expect(result.current.language).toBe('vi');
    });

    it('switches to English at runtime and persists preference', async () => {
      const { result } = renderHook(() => useAppLanguage(), { wrapper });

      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
      expect(i18n.language).toBe('en');
      expect(mockedPreferenceStorage.setStoredLanguagePreference).toHaveBeenCalledWith('en');
    });

    it('translates common keys into active language', async () => {
      const { result } = renderHook(() => useAppLanguage(), { wrapper });

      // Vietnamese check
      expect(result.current.t('common.confirm', 'Xác nhận')).toBe('Xác nhận');

      // Switch to English
      await act(async () => {
        await result.current.setLanguage('en');
      });

      expect(result.current.t('common.confirm', 'Confirm')).toBe('Confirm');
    });

    it('falls back to defaultValue if translation key is missing', () => {
      const { result } = renderHook(() => useAppLanguage(), { wrapper });

      const translation = result.current.t('non.existent.key', 'My Default');
      expect(translation).toBe('My Default');
    });

    it('falls back to key if defaultValue is omitted and key is missing', () => {
      const { result } = renderHook(() => useAppLanguage(), { wrapper });

      const translation = result.current.t('missing.key');
      expect(translation).toBe('missing.key');
    });
  });

  describe('Safe fallback outside provider', () => {
    it('returns default fallback without throwing', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAppLanguage());

      expect(result.current.language).toBe('vi');
      expect(result.current.t('some.key', 'Default')).toBe('Default');

      await act(async () => {
        await result.current.setLanguage('en');
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
