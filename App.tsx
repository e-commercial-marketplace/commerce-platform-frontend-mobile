import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from './src/api/queryClient';
import { colors } from './src/constants/theme';
import { AuthProvider } from './src/context/AuthContext';
import { useNotificationNavigation } from './src/hooks/useNotificationNavigation';
import AppNavigator from './src/navigation/AppNavigator';
import { linking } from './src/navigation/linking';
import { navigationRef } from './src/navigation/navigationRef';
import { initializeNotificationFoundation } from './src/services/notificationService';

/** Navigation theme aligned with the app design tokens. */
const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export default function App() {
  const { onNavigationReady } = useNotificationNavigation();

  useEffect(() => {
    void initializeNotificationFoundation();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        {/* Auth wraps the navigator so tabs, stack screens and the cart hook
            all read the same signed-in identity. The server-state client wraps
            everything so any feature query shares one cache. */}
        <AuthProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={appTheme}
            linking={linking}
            onReady={onNavigationReady}
          >
            <StatusBar style="dark" />
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
