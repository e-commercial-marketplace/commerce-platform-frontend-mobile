import * as SecureStore from 'expo-secure-store';

import {
  _resetPreferencesCacheForTesting,
  getCachedLanguagePreference,
  getCachedThemePreference,
  loadStoredPreferences,
  setStoredLanguagePreference,
  setStoredThemePreference,
} from '../preferenceStorage';

jest.mock('expo-secure-store');

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('preferenceStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetPreferencesCacheForTesting();
  });

  describe('loadStoredPreferences', () => {
    it('returns defaults (light, vi) when store is empty', async () => {
      mockedSecureStore.getItemAsync.mockResolvedValue(null);

      const prefs = await loadStoredPreferences();

      expect(prefs).toEqual({
        themePreference: 'light',
        language: 'vi',
      });
      expect(getCachedThemePreference()).toBe('light');
      expect(getCachedLanguagePreference()).toBe('vi');
    });

    it('safely migrates legacy stored "system" preference to "light" and persists it', async () => {
      mockedSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'app.ui.theme_preference') return 'system';
        if (key === 'app.ui.language_preference') return 'vi';
        return null;
      });

      const prefs = await loadStoredPreferences();

      expect(prefs).toEqual({
        themePreference: 'light',
        language: 'vi',
      });
      expect(getCachedThemePreference()).toBe('light');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'app.ui.theme_preference',
        'light',
      );
    });

    it('loads valid stored preferences (dark, en)', async () => {
      mockedSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'app.ui.theme_preference') return 'dark';
        if (key === 'app.ui.language_preference') return 'en';
        return null;
      });

      const prefs = await loadStoredPreferences();

      expect(prefs).toEqual({
        themePreference: 'dark',
        language: 'en',
      });
      expect(getCachedThemePreference()).toBe('dark');
      expect(getCachedLanguagePreference()).toBe('en');
    });

    it('falls back to defaults if stored values are invalid/corrupt', async () => {
      mockedSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === 'app.ui.theme_preference') return 'invalid-theme';
        if (key === 'app.ui.language_preference') return 'fr';
        return null;
      });

      const prefs = await loadStoredPreferences();

      expect(prefs).toEqual({
        themePreference: 'light',
        language: 'vi',
      });
    });

    it('handles SecureStore exceptions gracefully by falling back to defaults', async () => {
      mockedSecureStore.getItemAsync.mockRejectedValue(new Error('Hardware security unavailable'));

      const prefs = await loadStoredPreferences();

      expect(prefs).toEqual({
        themePreference: 'light',
        language: 'vi',
      });
    });
  });

  describe('setStoredThemePreference', () => {
    it('updates cache and calls SecureStore.setItemAsync', async () => {
      mockedSecureStore.setItemAsync.mockResolvedValue();

      await setStoredThemePreference('light');

      expect(getCachedThemePreference()).toBe('light');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'app.ui.theme_preference',
        'light',
      );
    });

    it('does not throw when SecureStore.setItemAsync fails', async () => {
      mockedSecureStore.setItemAsync.mockRejectedValue(new Error('Disk write error'));

      await expect(setStoredThemePreference('dark')).resolves.toBeUndefined();
      expect(getCachedThemePreference()).toBe('dark');
    });
  });

  describe('setStoredLanguagePreference', () => {
    it('updates cache and calls SecureStore.setItemAsync', async () => {
      mockedSecureStore.setItemAsync.mockResolvedValue();

      await setStoredLanguagePreference('en');

      expect(getCachedLanguagePreference()).toBe('en');
      expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
        'app.ui.language_preference',
        'en',
      );
    });

    it('does not throw when SecureStore.setItemAsync fails', async () => {
      mockedSecureStore.setItemAsync.mockRejectedValue(new Error('Disk write error'));

      await expect(setStoredLanguagePreference('vi')).resolves.toBeUndefined();
      expect(getCachedLanguagePreference()).toBe('vi');
    });
  });
});
