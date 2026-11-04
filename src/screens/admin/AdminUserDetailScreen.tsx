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
 * 7. Personalization: Theme-driven semantic styles & localized bilingual strings.
 */

import React, { useMemo } from 'react';
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
import { radii, spacing, typography } from '../../constants/theme';
import {
  useAdminUserDetail,
  useDisableAdminUser,
  useUpdateAdminUser,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import {
  getAccountStatusBadgeConfig,
  getRoleBadgeConfig,
  getSellerStatusBadgeConfig,
} from '../../utils/adminPresentation';

type Props = AppNavigatorScreenProps<'AdminUserDetail'>;

export function formatDateTime(isoString: string): string {
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
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

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
          <Text style={styles.unauthorizedTitle}>
            {t('admin.users.detail.unauthorizedTitle', 'Access denied')}
          </Text>
          <Text style={styles.unauthorizedMessage}>
            {t('admin.users.detail.unauthorizedMessage', 'Only system administrators have permission to view user details.')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('admin.common.actions.back', 'Go back')}
          >
            <Text style={styles.backButtonText}>
              {t('admin.common.actions.back', 'Go back')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>
            {t('admin.users.detail.loading', 'Loading user information…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    const errorMessage = error
      ? toApiError(error).message
      : t('admin.users.detail.notFound', 'User not found');
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>
            {t('admin.users.detail.errorTitle', 'Could not load information')}
          </Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('admin.common.actions.retry', 'Retry')}
            testID="retry-button"
          >
            <Text style={styles.retryButtonText}>
              {t('admin.common.actions.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const roleBadge = getRoleBadgeConfig(user.role, t, isDark);
  const accountBadge = getAccountStatusBadgeConfig(user.enabled, t, isDark);
  const sellerBadge =
    user.role === 'SELLER' && user.sellerStatus
      ? getSellerStatusBadgeConfig(user.sellerStatus, t, isDark)
      : null;

  const handleDisablePress = () => {
    if (isSelf) {
      Alert.alert(
        t('admin.users.detail.selfDisableAlertTitle', 'Cannot perform action'),
        t('admin.users.detail.selfDisableAlertMsg', 'You cannot disable your own account.'),
      );
      return;
    }

    Alert.alert(
      t('admin.users.detail.disableConfirmTitle', 'Disable account'),
      t(
        'admin.users.detail.disableConfirmMsg',
        `Bạn có chắc chắn muốn vô hiệu hóa tài khoản "${user.name}" không?\n\nNgười dùng sẽ không thể đăng nhập hoặc làm mới phiên, nhưng mọi dữ liệu đơn hàng và lịch sử sẽ được bảo lưu.`,
        { name: user.name },
      ),
      [
        { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.users.detail.disableConfirmBtn', 'Disable'),
          style: 'destructive',
          onPress: async () => {
            try {
              await disableMutation.mutateAsync(user.id);
              Alert.alert(
                t('admin.common.success', 'Success'),
                t('admin.users.detail.disableSuccess', 'The account has been disabled.'),
              );
            } catch (err: unknown) {
              Alert.alert(t('admin.common.error', 'Error'), toApiError(err).message);
            }
          },
        },
      ],
    );
  };

  const handleEnablePress = () => {
    Alert.alert(
      t('admin.users.detail.enableConfirmTitle', 'Reactivate account'),
      t(
        'admin.users.detail.enableConfirmMsg',
        `Bạn có chắc chắn muốn kích hoạt lại tài khoản "${user.name}" không?\n\nNgười dùng sẽ có thể đăng nhập lại vào hệ thống.`,
        { name: user.name },
      ),
      [
        { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.users.detail.enableConfirmBtn', 'Activate'),
          onPress: async () => {
            try {
              await updateMutation.mutateAsync({
                id: user.id,
                payload: { enabled: true },
              });
              Alert.alert(
                t('admin.common.success', 'Success'),
                t('admin.users.detail.enableSuccess', 'The account has been reactivated.'),
              );
            } catch (err: unknown) {
              Alert.alert(t('admin.common.error', 'Error'), toApiError(err).message);
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
              {t(
                'admin.users.detail.selfProtectionNotice',
                'Đây là tài khoản của bạn. Để đảm bảo an toàn hệ thống, bạn không thể tự khoá hoặc hạ vai trò của chính mình.',
              )}
            </Text>
          </View>
        ) : null}

        {/* Information Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionHeader}>
            {t('admin.users.detail.sectionInfo', 'Detailed information')}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.idLabel', 'Identifier (ID)')}
            </Text>
            <Text style={styles.infoValue} selectable>
              {user.id}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.emailLabel', 'Email')}
            </Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.phoneLabel', 'Phone number')}
            </Text>
            <Text style={styles.infoValue}>
              {user.phone ? user.phone : t('admin.users.detail.notUpdated', 'Not updated')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.addressLabel', 'Address')}
            </Text>
            <Text style={styles.infoValue}>
              {user.address ? user.address : t('admin.users.detail.notUpdated', 'Not updated')}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.createdAtLabel', 'Account created on')}
            </Text>
            <Text style={styles.infoValue}>{formatDateTime(user.createdAt)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('admin.users.detail.updatedAtLabel', 'Last updated')}
            </Text>
            <Text style={styles.infoValue}>{formatDateTime(user.updatedAt)}</Text>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeader}>
            {t('admin.users.detail.sectionActions', 'Management actions')}
          </Text>

          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('AdminUserEdit', { userId: user.id })}
            accessibilityRole="button"
            accessibilityLabel={t('admin.users.detail.editBtn', 'Edit information')}
            testID="edit-user-button"
          >
            <Text style={styles.actionButtonText}>
              {t('admin.users.detail.editBtn', 'Edit information')}
            </Text>
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
              accessibilityLabel={t('admin.users.detail.disableBtn', 'Disable account')}
              testID="disable-user-button"
            >
              {disableMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>
                  {t('admin.users.detail.disableBtn', 'Disable account')}
                </Text>
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
              accessibilityLabel={t('admin.users.detail.enableBtn', 'Reactivate account')}
              testID="enable-user-button"
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.onPrimary} />
              ) : (
                <Text style={styles.actionButtonText}>
                  {t('admin.users.detail.enableBtn', 'Reactivate account')}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme'], isDark = false) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.textSecondary,
    },
    errorTitle: {
      fontSize: typography.lg,
      fontWeight: '700',
      color: theme.text,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    errorMessage: {
      fontSize: typography.md,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontWeight: '600',
      fontSize: typography.base,
    },
    unauthorizedTitle: {
      fontSize: typography.xl,
      fontWeight: '700',
      color: theme.text,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    unauthorizedMessage: {
      fontSize: typography.md,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    backButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      backgroundColor: theme.primary,
      borderRadius: radii.sm,
    },
    backButtonText: {
      color: theme.onPrimary,
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
      backgroundColor: theme.surface,
      padding: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.md,
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    avatarText: {
      fontSize: typography.xl,
      fontWeight: '700',
      color: theme.onPrimary,
    },
    profileName: {
      fontSize: typography.lg,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
    },
    profileEmail: {
      fontSize: typography.md,
      color: theme.textSecondary,
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
      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#EFF8FF',
      borderWidth: 1,
      borderColor: isDark ? '#0284C7' : '#B2DDFF',
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
      color: isDark ? '#38BDF8' : '#175CD3',
      lineHeight: 18,
    },
    infoSection: {
      backgroundColor: theme.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      fontSize: typography.base,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.sm,
    },
    infoRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      fontSize: typography.xs,
      color: theme.textSecondary,
      marginBottom: 2,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    infoValue: {
      fontSize: typography.md,
      color: theme.text,
      fontWeight: '500',
    },
    actionsSection: {
      backgroundColor: theme.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
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
      backgroundColor: theme.primary,
    },
    disableButton: {
      backgroundColor: theme.danger,
    },
    enableButton: {
      backgroundColor: isDark ? '#059669' : '#027A48',
    },
    actionButtonText: {
      color: theme.onPrimary,
      fontSize: typography.base,
      fontWeight: '600',
    },
  });
