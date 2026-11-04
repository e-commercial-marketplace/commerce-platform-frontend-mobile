/**
 * Profile tab: guest entry points or the signed-in account (name, email,
 * role, phone, address from GET /users/me) with profile edit, logout and password change.
 * Integrated with UI Personalization (Theme & Language selectors and Settings screen).
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/queryKeys';
import { radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAppLanguage } from '../i18n';
import type { MainTabScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { Role } from '../types/auth';

/** First letters of the first and last name parts, e.g. "Nguyen Van An" → "NA". */
function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts[parts.length - 1]?.charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

/**
 * Resolves the display name for Profile screen presentation.
 * Preserves genuine dynamic user names ("Nguyễn Văn A", "John Doe", etc.)
 * while mapping the generic seeded ADMIN label ("Quản trị viên") to the localized role label.
 */
export function resolveProfileDisplayName(
  role: Role,
  rawName: string | undefined | null,
  roleLabels: Record<Role, string>,
): string {
  const trimmed = rawName?.trim();
  if (role === 'ADMIN' && trimmed === 'Quản trị viên') {
    return roleLabels.ADMIN;
  }
  return trimmed || roleLabels[role];
}

export default function ProfileScreen({ navigation }: MainTabScreenProps<'Profile'>) {
  const { user, isAuthenticated, isRestoring, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, isError: profileError, refetch } = useCurrentUser(
    isAuthenticated && !isRestoring,
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const roleLabels: Record<Role, string> = {
    CUSTOMER: t('profile.customer', 'Customer'),
    SELLER: t('profile.seller', 'Seller'),
    ADMIN: t('profile.admin', 'Administrator'),
  };

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
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('profile.restoringSession', 'Restoring your session…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || user == null) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <ScrollView contentContainerStyle={styles.guestContent}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('profile.welcomeGuest', 'Welcome, guest')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t(
              'profile.guestSubtitle',
              'Log in to see your account here. Your cart is kept either way.',
            )}
          </Text>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profile.login', 'Login')}
          >
            <Text style={styles.primaryButtonText}>{t('profile.login', 'Login')}</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Register')}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.primary,
              },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profile.createAccount', 'Create Account')}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
              {t('profile.createAccount', 'Create Account')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [
              styles.menuButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('profile.settings', 'Personalization & Settings')}
            testID="settings-button"
          >
            <Text style={[styles.menuButtonText, { color: theme.text }]}>
             {t('profile.settings', 'Personalization & Settings')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const displayUser = profile ?? user;
  const rawName = displayUser.name?.trim();
  const displayName = resolveProfileDisplayName(displayUser.role, rawName, roleLabels);
  const displayEmail = displayUser.email;
  const displayRole = displayUser.role;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: theme.primary }]}>
            {getInitials(displayName)}
          </Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{displayName}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{displayEmail}</Text>

        {profileLoading && !profile ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.inlineLoadingText, { color: theme.textSecondary }]}>
              {t('profile.loadingProfile', 'Loading profile…')}
            </Text>
          </View>
        ) : null}

        {profileError ? (
          <View style={styles.errorBlock}>
            <Text style={[styles.errorText, { color: theme.danger }]}>
              {t('profile.errorLoadingProfile', "Couldn't load latest profile.")}
            </Text>
            <Pressable
              onPress={() => {
                void refetch();
              }}
              style={[
                styles.retrySmallButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.retry', 'Retry')}
            >
              <Text style={[styles.retrySmallButtonText, { color: theme.text }]}>
                {t('profile.retry', 'Retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Account Info Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
              {t('profile.status', 'Status')}
            </Text>
            <Text style={[styles.cardValue, { color: theme.text }]}>
              {t('profile.signedIn', 'Signed in')}
            </Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
              {t('profile.role', 'Role')}
            </Text>
            <Text style={[styles.cardValue, { color: theme.text }]}>
              {roleLabels[displayRole]}
            </Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
              {t('profile.phone', 'Phone')}
            </Text>
            <Text style={[styles.cardValue, { color: theme.text }]}>
              {profile?.phone || t('profile.notSet', 'Not set')}
            </Text>
          </View>
          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
              {t('profile.address', 'Address')}
            </Text>
            <Text style={[styles.cardValue, styles.cardValueWrap, { color: theme.text }]}>
              {profile?.address || t('profile.notSet', 'Not set')}
            </Text>
          </View>
        </View>

        {/* Role-Specific Actions */}
        {displayRole === 'CUSTOMER' ? (
          <>
            <Pressable
              onPress={() => {
                navigation.navigate('MyOrders');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.myOrders', 'My Orders')}
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.myOrders', 'My Orders')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                navigation.navigate('ConversationList');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.messages', 'Messages')}
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.messages', 'Messages')}
              </Text>
            </Pressable>
          </>
        ) : null}

        {displayRole === 'SELLER' ? (
          <>
            <Pressable
              onPress={() => {
                navigation.navigate('SellerProducts');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.myProducts', 'My Products')}
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.myProducts', 'My Products')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                navigation.navigate('SellerFulfillment');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.sellerOrders', 'Seller Orders')}
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.sellerOrders', 'Seller Orders')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                navigation.navigate('ConversationList');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.sellerMessages', 'Customer Messages')}
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.sellerMessages', 'Customer Messages')}
              </Text>
            </Pressable>
          </>
        ) : null}

        {displayRole === 'ADMIN' ? (
          <>
            <Pressable
              onPress={() => {
                navigation.navigate('AdminPortal');
              }}
              style={({ pressed }) => [
                styles.menuButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('profile.adminPortal', 'System Administration')}
              testID="admin-portal-button"
            >
              <Text style={[styles.menuButtonText, { color: theme.text }]}>
                {t('profile.adminPortal', 'System Administration')}
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* Dedicated Settings Navigation Button */}
        <Pressable
          onPress={() => {
            navigation.navigate('Settings');
          }}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.settings', 'Personalization & Settings')}
          testID="settings-button"
        >
          <Text style={[styles.menuButtonText, { color: theme.text }]}>
            {t('profile.settings', 'Personalization & Settings')}
          </Text>
        </Pressable>

        {/* Edit Profile */}
        <Pressable
          onPress={() => {
            navigation.navigate('EditProfile');
          }}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editProfile', 'Edit Profile')}
        >
          <Text style={[styles.menuButtonText, { color: theme.text }]}>
            {t('profile.editProfile', 'Edit Profile')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            navigation.navigate('ChangePassword');
          }}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePassword', 'Change Password')}
        >
          <Text style={[styles.menuButtonText, { color: theme.text }]}>
            {t('profile.changePassword', 'Change Password')}
          </Text>
        </Pressable>

        {/* Logout */}
        <Pressable
          onPress={() => {
            void handleLogout();
          }}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: theme.background,
              borderColor: theme.danger,
            },
            (pressed || loggingOut) && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.logout', 'Logout')}
          accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
        >
          {loggingOut ? (
            <View style={styles.logoutRow}>
              <ActivityIndicator color={theme.danger} size="small" />
              <Text style={[styles.logoutButtonText, { color: theme.danger }]}>
                {t('profile.loggingOut', 'Logging out...')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.logoutButtonText, { color: theme.danger }]}>
              {t('profile.logout', 'Logout')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    borderWidth: 1,
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
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: radii.md,
    borderWidth: 1,
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
  },
  cardValueWrap: {
    flexShrink: 1,
    marginLeft: spacing.md,
    textAlign: 'right',
  },
  cardValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardDivider: {
    height: 1,
  },
  primaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  menuButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
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
  },
  errorBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 13,
  },
  retrySmallButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  retrySmallButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
