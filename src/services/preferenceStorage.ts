/**
 * Local preference persistence backed by expo-secure-store.
 *
 * Persists device-local preferences for:
 * 1. UI Theme mode ('light' | 'dark')
 * 2. Application Language ('vi' | 'en')
 *
 * Stored locally on device; never sent to the backend.
 * Uses memory caching for immediate synchronous reads after initialization.
 */

import * as SecureStore from 'expo-secure-store';

import type { ThemePreference } from '../theme/types';
import type { SupportedLanguage } from '../i18n/types';

const THEME_PREFERENCE_KEY = 'app.ui.theme_preference';
const LANGUAGE_PREFERENCE_KEY = 'app.ui.language_preference';

let cachedThemePreference: ThemePreference | null = null;
let cachedLanguagePreference: SupportedLanguage | null = null;

/**
 * Loads stored UI preferences from local SecureStore into memory cache.
 * Safely migrates legacy stored 'system' theme preference to 'light'.
 */
export async function loadStoredPreferences(): Promise<{
  themePreference: ThemePreference;
  language: SupportedLanguage;
}> {
  try {
    const [storedTheme, storedLanguage] = await Promise.all([
      SecureStore.getItemAsync(THEME_PREFERENCE_KEY),
      SecureStore.getItemAsync(LANGUAGE_PREFERENCE_KEY),
    ]);

    if (storedTheme === 'light' || storedTheme === 'dark') {
      cachedThemePreference = storedTheme;
    } else {
      // If missing, invalid, or legacy 'system', safely fallback to 'light'
      cachedThemePreference = 'light';
      // Persist the migration if it was explicitly 'system'
      if (storedTheme === 'system') {
        void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, 'light');
      }
    }

    if (storedLanguage === 'vi' || storedLanguage === 'en') {
      cachedLanguagePreference = storedLanguage;
    } else {
      cachedLanguagePreference = 'vi';
    }
  } catch {
    // If SecureStore fails, fall back to default preferences
    cachedThemePreference = 'light';
    cachedLanguagePreference = 'vi';
  }

  return {
    themePreference: cachedThemePreference,
    language: cachedLanguagePreference,
  };
}

/**
 * Synchronous read of cached theme preference (defaults to 'light').
 */
export function getCachedThemePreference(): ThemePreference {
  return cachedThemePreference ?? 'light';
}

/**
 * Persists and caches theme preference.
 */
export async function setStoredThemePreference(preference: ThemePreference): Promise<void> {
  cachedThemePreference = preference;
  try {
    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Non-fatal: in-memory cache still updated
  }
}

/**
 * Synchronous read of cached language preference (defaults to 'vi').
 */
export function getCachedLanguagePreference(): SupportedLanguage {
  return cachedLanguagePreference ?? 'vi';
}

/**
 * Persists and caches language preference.
 */
export async function setStoredLanguagePreference(language: SupportedLanguage): Promise<void> {
  cachedLanguagePreference = language;
  try {
    await SecureStore.setItemAsync(LANGUAGE_PREFERENCE_KEY, language);
  } catch {
    // Non-fatal: in-memory cache still updated
  }
}

/**
 * Resets in-memory cached preferences (primarily for test isolation).
 */
export function _resetPreferencesCacheForTesting(): void {
  cachedThemePreference = null;
  cachedLanguagePreference = null;
}

