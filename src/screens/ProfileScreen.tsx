/**
 * Profile tab: guest entry points or the signed-in account (name, email,
 * role from the backend UserSummaryResponse) with logout and password change.
 * While the stored session is being restored at startup a loading state is
 * shown instead of a flash of the guest state. Edit profile, avatar, etc.
 * belong to later features.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { queryKeys } from '../api/queryKeys';
import type { MainTabScreenProps } from '../navigation/types';
import type { Role } from '../types/auth';

/** Display labels for the backend Role enum. */
const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  SELLER: 'Seller',
  ADMIN: 'Administrator',
};

/** First letters of the first and last name parts, e.g. "Nguyen Van An" → "NA". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

export default function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const { user, isAuthenticated, isRestoring, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch } = useCurrentUser(
    isAuthenticated && !isRestoring,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.removeQueries({ queryKey: queryKeys.user.me() });
    }
  }, [isAuthenticated, queryClient]);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  if (isRestoring) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>Restoring your session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.guestContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.title}>Welcome, guest</Text>
          <Text style={styles.subtitle}>
            Log in to see your account here. Your cart is kept either way.
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text style={styles.primaryButtonText}>Login</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const displayUser = profile ?? user;
  const displayName = displayUser.name;
  const displayEmail = displayUser.email;
  const displayRole = displayUser.role;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
        </View>
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>{displayEmail}</Text>
        {profileLoading && !profile ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.inlineLoadingText}>Loading profile…</Text>
          </View>
        ) : null}
        {profileError ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>Couldn't load latest profile.</Text>
            <Pressable
              onPress={() => {
                void refetch();
              }}
              style={styles.retrySmallButton}
              accessibilityRole="button"
            >
              <Text style={styles.retrySmallButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text style={styles.cardValue}>Signed in</Text>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Role</Text>
            <Text style={styles.cardValue}>{ROLE_LABELS[displayRole]}</Text>
          </View>
        </View>

        {displayRole === 'CUSTOMER' ? (
          <Pressable
            onPress={() => {
              navigation.navigate('MyOrders');
            }}
            style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="My Orders"
          >
            <Text style={styles.menuButtonText}>My Orders</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {
            navigation.navigate('ChangePassword');
          }}
          style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Change Password"
        >
          <Text style={styles.menuButtonText}>Change Password</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void handleLogout();
          }}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.logoutButton,
            (pressed || loggingOut) && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
        >
          {loggingOut ? (
            <View style={styles.logoutRow}>
              <ActivityIndicator color={colors.danger} size="small" />
              <Text style={styles.logoutButtonText}>Logging out...</Text>
            </View>
          ) : (
            <Text style={styles.logoutButtonText}>Logout</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Centered state used for the guest screen and the restore spinner.
  guestContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  // Top-aligned layout for the signed-in state.
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  // Account summary card (signed-in state).
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  primaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  menuButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  logoutButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  inlineLoadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  retrySmallButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retrySmallButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
});
