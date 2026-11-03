/**
 * Application Theme Context and Provider.
 *
 * Implements:
 * 1. Preference state ('light' | 'dark')
 * 2. Resolved theme ('light' | 'dark')
 * 3. Immediate reactive updates when switching preferences
 * 4. Device-local persistence via preferenceStorage (backed by expo-secure-store)
 * 5. Integration with TamaguiProvider at root
 * 6. Safe fallback for useAppTheme() so tests outside provider never crash
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TamaguiProvider } from '@tamagui/core';

import {
  getCachedThemePreference,
  loadStoredPreferences,
  setStoredThemePreference,
} from '../services/preferenceStorage';
import { tamaguiConfig } from './tamagui.config';
import { darkColors, darkTokens, lightColors, lightTokens } from './tokens';
import type {
  AppThemeContextValue,
  ResolvedTheme,
  ThemePreference,
} from './types';

export const ThemeContext = createContext<AppThemeContextValue | null>(null);

const defaultThemeContextValue: AppThemeContextValue = {
  themePreference: 'light',
  resolvedTheme: 'light',
  isDark: false,
  setThemePreference: async () => {},
  theme: lightColors,
  tokens: lightTokens,
};

interface AppThemeProviderProps {
  children: ReactNode;
  initialPreference?: ThemePreference;
}

export function AppThemeProvider({
  children,
  initialPreference,
}: AppThemeProviderProps) {
  const hasExplicitlyChangedRef = useRef(false);

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    initialPreference ?? getCachedThemePreference(),
  );

  // Initialize preference from storage
  useEffect(() => {
    let isMounted = true;
    void loadStoredPreferences().then(({ themePreference: storedPref }) => {
      if (isMounted && initialPreference === undefined && !hasExplicitlyChangedRef.current) {
        setThemePreferenceState(storedPref);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initialPreference]);

  // Compute resolved theme: Light => light, Dark => dark
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    return themePreference === 'dark' ? 'dark' : 'light';
  }, [themePreference]);

  const setThemePreference = useCallback(async (newPreference: ThemePreference) => {
    hasExplicitlyChangedRef.current = true;
    setThemePreferenceState(newPreference);
    await setStoredThemePreference(newPreference);
  }, []);

  const isDark = resolvedTheme === 'dark';
  const theme = isDark ? darkColors : lightColors;
  const tokens = isDark ? darkTokens : lightTokens;

  const value: AppThemeContextValue = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      isDark,
      setThemePreference,
      theme,
      tokens,
    }),
    [themePreference, resolvedTheme, isDark, setThemePreference, theme, tokens],
  );

  return (
    <ThemeContext.Provider value={value}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme}>
        {children}
      </TamaguiProvider>
    </ThemeContext.Provider>
  );
}

/**
 * Accesses current app theme context with safe default fallback.
 * Can be called anywhere; if outside provider, defaults to light theme without throwing.
 */
export function useAppTheme(): AppThemeContextValue {
  const context = useContext(ThemeContext);
  return context ?? defaultThemeContextValue;
}
