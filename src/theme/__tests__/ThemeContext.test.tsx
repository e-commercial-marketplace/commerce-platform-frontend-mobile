import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import * as preferenceStorage from '../../services/preferenceStorage';
import { darkColors, lightColors } from '../tokens';
import { AppThemeProvider, useAppTheme } from '../ThemeContext';

jest.mock('../../services/preferenceStorage');

const mockedPreferenceStorage = preferenceStorage as jest.Mocked<typeof preferenceStorage>;

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPreferenceStorage.loadStoredPreferences.mockResolvedValue({
      themePreference: 'light',
      language: 'vi',
    });
    mockedPreferenceStorage.getCachedThemePreference.mockReturnValue('light');
    mockedPreferenceStorage.setStoredThemePreference.mockResolvedValue();
  });

  describe('AppThemeProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppThemeProvider>{children}</AppThemeProvider>
    );

    it('defaults to light preference', () => {
      const { result } = renderHook(() => useAppTheme(), { wrapper });

      expect(result.current.themePreference).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(result.current.isDark).toBe(false);
      expect(result.current.theme.background).toBe(lightColors.background);
    });

    it('explicitly setting dark theme updates state and stores dark preference', async () => {
      const { result } = renderHook(() => useAppTheme(), { wrapper });

      await act(async () => {
        await result.current.setThemePreference('dark');
      });

      expect(result.current.themePreference).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
      expect(result.current.isDark).toBe(true);
      expect(result.current.theme.background).toBe(darkColors.background);
      expect(mockedPreferenceStorage.setStoredThemePreference).toHaveBeenCalledWith('dark');
    });

    it('explicitly setting light theme updates state and stores light preference', async () => {
      const { result } = renderHook(() => useAppTheme(), {
        wrapper: ({ children }) => (
          <AppThemeProvider initialPreference="dark">{children}</AppThemeProvider>
        ),
      });

      expect(result.current.isDark).toBe(true);

      await act(async () => {
        await result.current.setThemePreference('light');
      });

      expect(result.current.themePreference).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(result.current.isDark).toBe(false);
      expect(result.current.theme.background).toBe(lightColors.background);
      expect(mockedPreferenceStorage.setStoredThemePreference).toHaveBeenCalledWith('light');
    });

    it('provides design tokens (spacing, radii, typography)', () => {
      const { result } = renderHook(() => useAppTheme(), { wrapper });

      expect(result.current.tokens).toBeDefined();
      expect(result.current.tokens.spacing).toBeDefined();
      expect(result.current.tokens.radii).toBeDefined();
      expect(result.current.tokens.typography).toBeDefined();
    });
  });

  describe('Safe fallback when outside provider', () => {
    it('returns valid light fallback without throwing', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAppTheme());

      expect(result.current.themePreference).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
      expect(result.current.isDark).toBe(false);
      expect(result.current.theme.background).toBe(lightColors.background);
      expect(result.current.tokens).toBeDefined();

      // Calling setThemePreference outside provider should resolve safely
      await act(async () => {
        await result.current.setThemePreference('dark');
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
