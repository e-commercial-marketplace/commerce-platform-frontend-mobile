import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from './src/api/queryClient';
import { AuthProvider } from './src/context/AuthContext';
import { useNotificationNavigation } from './src/hooks/useNotificationNavigation';
import { AppI18nProvider } from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { linking } from './src/navigation/linking';
import { navigationRef } from './src/navigation/navigationRef';
import { initializeNotificationFoundation } from './src/services/notificationService';
import { AppThemeProvider, useAppTheme } from './src/theme';

/**
 * Root Navigation Shell with Dynamic Theme & Status Bar Awareness.
 */
function RootAppContent() {
  const { onNavigationReady } = useNotificationNavigation();
  const { theme, isDark } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: theme.primary,
        background: theme.background,
        card: theme.surface,
        text: theme.text,
        border: theme.border,
      },
    };
  }, [isDark, theme]);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      onReady={onNavigationReady}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    void initializeNotificationFoundation();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Auth wraps the navigator so tabs, stack screens and the cart hook
            all read the same signed-in identity.
            AppThemeProvider supplies TamaguiProvider and reactive theme tokens.
            AppI18nProvider supplies runtime language switching. */}
        <AuthProvider>
          <AppThemeProvider>
            <AppI18nProvider>
              <RootAppContent />
            </AppI18nProvider>
          </AppThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
