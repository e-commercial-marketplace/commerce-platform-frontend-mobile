/**
 * Admin Portal — User Detail Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Only authenticated users with Role.ADMIN can access.
 * 2. Real Backend Data: GET /api/v1/admin/users/{id}
 * 3. Comprehensive profile presentation:
 *    - Full Name, Email, Phone, Address, Role, Account Status, Seller Status, Timestamps.
 * 4. Actions:
 *    - Edit user (navigate to AdminUserEdit).
 *    - Soft-disable user (DELETE /api/v1/admin/users/{id}) with destructive confirmation.
 *    - Re-enable user (PATCH /api/v1/admin/users/{id} with enabled=true) with confirmation.
 * 5. Current Admin Self-Protection:
 *    - Prevents admin from disabling their own account.
 * 6. Resilient error handling and accessibility.
 */

import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import {
  useAdminUserDetail,
  useDisableAdminUser,
  useUpdateAdminUser,
} from '../../hooks/useAdmin';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { Role } from '../../types/auth';
import type { SellerStatus } from '../../types/adminApi';

type Props = AppNavigatorScreenProps<'AdminUserDetail'>;

const ROLE_BADGE_CONFIG: Record<
  Role,
  { label: string; backgroundColor: string; textColor: string }
> = {
  CUSTOMER: {
    label: 'Customer',
    backgroundColor: '#EFF8FF',
    textColor: '#175CD3',
  },
  SELLER: {
    label: 'Seller',
    backgroundColor: '#F9F5FF',
    textColor: '#6941C6',
  },
  ADMIN: {
    label: 'Admin',
    backgroundColor: '#F2F4F7',
    textColor: '#344054',
  },
};

const SELLER_STATUS_CONFIG: Record<
  SellerStatus,
  { label: string; backgroundColor: string; textColor: string }
> = {
  PENDING: {
    label: 'Pending',
    backgroundColor: '#FEF0C7',
    textColor: '#B54708',
  },
  APPROVED: {
    label: 'Approved',
    backgroundColor: '#ECFDF3',
    textColor: '#027A48',
  },
  SUSPENDED: {
    label: 'Suspended',
    backgroundColor: '#FEF3F2',
    textColor: '#B42318',
  },
  REJECTED: {
    label: 'Rejected',
    backgroundColor: '#F2F4F7',
    textColor: '#475467',
  },
};

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AdminUserDetailScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { user: currentUser, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && currentUser?.role === 'ADMIN';

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminUserDetail(userId, isAdmin);

  const disableMutation = useDisableAdminUser();
  const updateMutation = useUpdateAdminUser();

  const isSelf = user?.id === currentUser?.id;

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedMessage}>
            Only system administrators can access user details.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading user information…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    const errorMessage = error ? toApiError(error).message : 'User does not exist';
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load information</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            testID="retry-button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const roleBadge = ROLE_BADGE_CONFIG[user.role] ?? {
    label: user.role,
    backgroundColor: '#F2F4F7',
    textColor: '#344054',
  };

  const accountBadge = user.enabled
    ? { label: 'Active', backgroundColor: '#ECFDF3', textColor: '#027A48' }
    : { label: 'Disabled', backgroundColor: '#FEF3F2', textColor: '#B42318' };

  const sellerBadge =
    user.role === 'SELLER' && user.sellerStatus
      ? SELLER_STATUS_CONFIG[user.sellerStatus]
      : null;

  const handleDisablePress = () => {
    if (isSelf) {
      Alert.alert('Cannot perform action', 'You cannot disable your own account.');
      return;
    }

    Alert.alert(
      'Disable account',
      `Are you sure you want to disable the account "${user.name}"?\n\nThe user will not be able to sign in or refresh the session, but all order data and history will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              await disableMutation.mutateAsync(user.id);
              Alert.alert('Success', 'The account has been disabled.');
            } catch (err: unknown) {
              Alert.alert('Error', toApiError(err).message);
            }
          },
        },
      ],
    );
  };

  const handleEnablePress = () => {
    Alert.alert(
      'Reactivate account',
      `Are you sure you want to reactivate the account "${user.name}"?\n\nThe user will be able to sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                id: user.id,
                payload: { enabled: true },
              });
              Alert.alert('Success', 'The account has been reactivated.');
            } catch (err: unknown) {
              Alert.alert('Error', toApiError(err).message);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user.name.trim().charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>

          <View style={styles.badgeRow}>
            <View
              style={[styles.badge, { backgroundColor: roleBadge.backgroundColor }]}
              testID="detail-role-badge"
            >
              <Text style={[styles.badgeText, { color: roleBadge.textColor }]}>
                {roleBadge.label}
              </Text>
            </View>

            <View
              style={[styles.badge, { backgroundColor: accountBadge.backgroundColor }]}
              testID="detail-status-badge"
            >
              <Text style={[styles.badgeText, { color: accountBadge.textColor }]}>
                {accountBadge.label}
              </Text>
            </View>

            {sellerBadge ? (
              <View
                style={[styles.badge, { backgroundColor: sellerBadge.backgroundColor }]}
                testID="detail-seller-status-badge"
              >
                <Text style={[styles.badgeText, { color: sellerBadge.textColor }]}>
                  {sellerBadge.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Self-protection info notice */}
        {isSelf ? (
          <View style={styles.selfNoticeBox} testID="self-protection-notice">
            <Text style={styles.noticeIcon}>🛡️</Text>
            <Text style={styles.selfNoticeText}>
              This is your own account. For system safety, you cannot lock yourself or lower your own role.
            </Text>
          </View>
        ) : null}

        {/* Information Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionHeader}>Detailed information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Identifier (ID)</Text>
            <Text style={styles.infoValue} selectable>
              {user.id}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone number</Text>
            <Text style={styles.infoValue}>
              {user.phone ? user.phone : 'Not updated'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>
              {user.address ? user.address : 'Not updated'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account created on</Text>
            <Text style={styles.infoValue}>{formatDateTime(user.createdAt)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last updated</Text>
            <Text style={styles.infoValue}>{formatDateTime(user.updatedAt)}</Text>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeader}>Management actions</Text>

          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('AdminUserEdit', { userId: user.id })}
            accessibilityRole="button"
            accessibilityLabel="Edit information"
            testID="edit-user-button"
          >
            <Text style={styles.actionButtonText}>Edit information</Text>
          </Pressable>

          {!isSelf && user.enabled ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.disableButton,
                pressed && styles.buttonPressed,
                disableMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleDisablePress}
              disabled={disableMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Disable account"
              testID="disable-user-button"
            >
              {disableMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>Disable account</Text>
              )}
            </Pressable>
          ) : null}

          {!isSelf && !user.enabled ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.enableButton,
                pressed && styles.buttonPressed,
                updateMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleEnablePress}
              disabled={updateMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Reactivate account"
              testID="enable-user-button"
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>Reactivate account</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  stateIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.base,
  },
  unauthorizedTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  backButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.base,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  profileName: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: typography.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  selfNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF8FF',
    borderWidth: 1,
    borderColor: '#B2DDFF',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  noticeIcon: {
    fontSize: 20,
  },
  selfNoticeText: {
    flex: 1,
    fontSize: typography.sm,
    color: '#175CD3',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: typography.md,
    color: colors.text,
    fontWeight: '500',
  },
  actionsSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  disableButton: {
    backgroundColor: colors.danger,
  },
  enableButton: {
    backgroundColor: '#027A48',
  },
  actionButtonText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    fontWeight: '600',
  },
});
