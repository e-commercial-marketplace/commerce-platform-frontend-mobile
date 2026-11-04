/**
 * Admin Portal — Edit User Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Only authenticated users with Role.ADMIN can access.
 * 2. Real Backend Contract: PATCH /api/v1/admin/users/{id}
 * 3. Editable fields supported by backend:
 *    - name: @NullOrNotBlank @Size(max = 255)
 *    - phone: Vietnamese phone number or empty string to delete
 *    - address: max 500 chars or empty string to delete
 *    - role: CUSTOMER | SELLER | ADMIN
 *    - sellerStatus: only allowed if role == SELLER (PENDING | APPROVED | SUSPENDED | REJECTED)
 * 4. Read-only fields:
 *    - email: Backend does not support changing email
 *    - id
 * 5. Current Admin Self-Protection:
 *    - Admin cannot change the role of their own account (role picker disabled).
 * 6. Explicit Role Change Confirmation:
 *    - Prompts admin before committing a role change (e.g. CUSTOMER -> SELLER).
 * 7. Error handling & Accessibility.
 * 8. Personalization: Theme-driven semantic styles & localized bilingual strings.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { radii, spacing, typography } from '../../constants/theme';
import { useAdminUserDetail, useUpdateAdminUser } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { AdminUserUpdateRequest, SellerStatus } from '../../types/adminApi';
import type { Role } from '../../types/auth';

type Props = AppNavigatorScreenProps<'AdminUserEdit'>;

const VIETNAMESE_PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;

export default function AdminUserEditScreen({ route, navigation }: Props) {
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

  const updateMutation = useUpdateAdminUser();

  const isSelf = user?.id === currentUser?.id;

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [sellerStatus, setSellerStatus] = useState<SellerStatus | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const roleOptions: { role: Role; label: string }[] = useMemo(
    () => [
      { role: 'CUSTOMER', label: t('admin.enums.role.customer', 'Customer') },
      { role: 'SELLER', label: t('admin.enums.role.seller', 'Seller') },
      { role: 'ADMIN', label: t('admin.enums.role.admin', 'Admin') },
    ],
    [t],
  );

  const sellerStatusOptions: { status: SellerStatus; label: string }[] = useMemo(
    () => [
      { status: 'PENDING', label: t('admin.users.sellerStatusPending', 'Pending (PENDING)') },
      { status: 'APPROVED', label: t('admin.users.sellerStatusApproved', 'Approved (APPROVED)') },
      { status: 'SUSPENDED', label: t('admin.users.sellerStatusSuspended', 'Suspended (SUSPENDED)') },
      { status: 'REJECTED', label: t('admin.users.sellerStatusRejected', 'Rejected (REJECTED)') },
    ],
    [t],
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setSellerStatus(user.sellerStatus ?? undefined);
      setPhone(user.phone ?? '');
      setAddress(user.address ?? '');
    }
  }, [user]);

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>
            {t('admin.users.edit.unauthorizedTitle', 'Access denied')}
          </Text>
          <Text style={styles.unauthorizedMessage}>
            {t('admin.users.edit.unauthorizedMessage', 'Only system administrators have permission to edit user information.')}
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
            {t('admin.common.loading', 'Đang tải thông tin…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    const errorMessage = error
      ? toApiError(error).message
      : t('admin.users.detail.notFound', 'Người dùng không tồn tại');
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = t('admin.users.edit.validation.nameRequired', 'Please enter your full name');
    } else if (trimmedName.length > 255) {
      errors.name = t('admin.users.edit.validation.nameTooLong', 'Full name must be at most 255 characters');
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !VIETNAMESE_PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = t(
        'admin.users.edit.validation.phoneInvalid',
        'Invalid Vietnamese mobile phone number (e.g. 0912345678)',
      );
    }

    if (address.length > 500) {
      errors.address = t('admin.users.edit.validation.addressTooLong', 'Address must be at most 500 characters');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const executeUpdate = async () => {
        setServerError(null);

    const payload: AdminUserUpdateRequest = {};

    if (name.trim() !== user.name) {
      payload.name = name.trim();
    }

    if (!isSelf && role !== user.role) {
      payload.role = role;
    }

    // sellerStatus is ONLY sent if role is SELLER
    if (role === 'SELLER' && sellerStatus && sellerStatus !== user.sellerStatus) {
      payload.sellerStatus = sellerStatus;
    }

    // phone: send normalized or empty string to delete if modified
    const currentPhone = user.phone ?? '';
    if (phone.trim() !== currentPhone) {
      payload.phone = phone.trim();
    }

    // address: send trimmed or empty string to delete if modified
    const currentAddress = user.address ?? '';
    if (address.trim() !== currentAddress) {
      payload.address = address.trim();
    }

    // If nothing changed, return
    if (Object.keys(payload).length === 0) {
      Alert.alert(
        t('admin.users.edit.noChangeTitle', 'Notice'),
        t('admin.users.edit.noChangeMsg', 'No information has changed.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: user.id, payload });
      Alert.alert(
        t('admin.users.edit.successTitle', 'Success'),
        t('admin.users.edit.successMsg', 'User information updated successfully.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      const apiErr = toApiError(err);
            setServerError(apiErr.message);
    }
  };

  const handleSavePress = () => {
        if (!validateForm()) return;

    // If role changed and not self, require explicit confirmation
    if (!isSelf && role !== user.role) {
      const oldRoleLabel = roleOptions.find((r) => r.role === user.role)?.label ?? user.role;
      const newRoleLabel = roleOptions.find((r) => r.role === role)?.label ?? role;

      Alert.alert(
        t('admin.users.edit.roleChangeConfirmTitle', 'Confirm role change'),
        t(
          'admin.users.edit.roleChangeConfirmMsg',
          `Vai trò của tài khoản sẽ thay đổi từ "${oldRoleLabel}" sang "${newRoleLabel}".\n\nBạn có chắc chắn muốn áp dụng thay đổi này không?`,
          { oldRole: oldRoleLabel, newRole: newRoleLabel },
        ),
        [
          { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
          { text: t('admin.common.actions.confirm', 'Agree'), onPress: executeUpdate },
        ],
      );
      return;
    }

    executeUpdate();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {serverError ? (
            <View style={styles.serverErrorBox} testID="server-error-banner">
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          ) : null}

          {/* Readonly: Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('admin.users.detail.emailLabel', 'Email')}</Text>
            <View style={styles.readOnlyContainer}>
              <Text style={styles.readOnlyText}>{user.email}</Text>
              <Text style={styles.readOnlyHelp}>
                {t('admin.users.edit.emailReadonlyHelp', 'Email cannot be changed after creation')}
              </Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.nameLabel', 'Full name')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.name ? styles.inputError : null]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
              }}
              testID="edit-name-input"
            />
            {formErrors.name ? <Text style={styles.errorText}>{formErrors.name}</Text> : null}
          </View>

          {/* Role Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.roleLabel', 'Role')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            {isSelf ? (
              <View style={styles.selfNoticeBox} testID="edit-self-role-notice">
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={styles.selfNoticeText}>
                  {t(
                    'admin.users.edit.selfRoleNotice',
                    'Bạn đang chỉnh sửa tài khoản của mình. Admin không thể tự đổi vai trò của chính mình.',
                  )}
                </Text>
              </View>
            ) : (
              <View style={styles.roleTabsRow}>
                {roleOptions.map((item) => {
                  const isSelected = role === item.role;
                  return (
                    <Pressable
                      key={item.role}
                      style={[styles.roleTab, isSelected && styles.roleTabActive]}
                      onPress={() => {
                        setRole(item.role);
                        if (item.role === 'SELLER' && !sellerStatus) {
                          setSellerStatus('PENDING');
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      testID={`edit-role-${item.role}`}
                    >
                      <Text
                        style={[styles.roleTabText, isSelected && styles.roleTabTextActive]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Seller Status Selection (Only if role is SELLER) */}
          {role === 'SELLER' ? (
            <View style={styles.fieldGroup} testID="edit-seller-status-group">
              <Text style={styles.label}>
                {t('admin.users.edit.sellerStatusLabel', 'Trạng thái người bán (sellerStatus)')}
              </Text>
              <View style={styles.sellerStatusContainer}>
                {sellerStatusOptions.map((item) => {
                  const isSelected = sellerStatus === item.status;
                  return (
                    <Pressable
                      key={item.status}
                      style={[styles.statusOption, isSelected && styles.statusOptionActive]}
                      onPress={() => setSellerStatus(item.status)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      testID={`seller-status-option-${item.status}`}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected ? <View style={styles.radioInnerCircle} /> : null}
                      </View>
                      <Text
                        style={[styles.statusOptionText, isSelected && styles.statusOptionTextActive]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.detail.phoneLabel', 'Phone number')}
            </Text>
            <TextInput
              style={[styles.input, formErrors.phone ? styles.inputError : null]}
              placeholder={t('admin.users.edit.phonePlaceholder', '0912345678 (leave empty to clear)')}
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: '' }));
              }}
              keyboardType="phone-pad"
              testID="edit-phone-input"
            />
            {formErrors.phone ? <Text style={styles.errorText}>{formErrors.phone}</Text> : null}
          </View>

          {/* Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.detail.addressLabel', 'Address')}
            </Text>
            <TextInput
              style={[styles.input, formErrors.address ? styles.inputError : null]}
              placeholder={t('admin.users.edit.addressPlaceholder', 'Contact address (leave empty to clear)')}
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (formErrors.address) setFormErrors((p) => ({ ...p, address: '' }));
              }}
              maxLength={500}
              testID="edit-address-input"
            />
            {formErrors.address ? (
              <Text style={styles.errorText}>{formErrors.address}</Text>
            ) : null}
          </View>

          {/* Save Button */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.buttonPressed,
              updateMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={handleSavePress}
            disabled={updateMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('admin.users.edit.saveBtn', 'Lưu thay đổi')}
            testID="submit-edit-user-button"
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>
                {t('admin.users.edit.saveBtn', 'Lưu thay đổi')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme'], isDark = false) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    serverErrorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF3F2',
      borderWidth: 1,
      borderColor: isDark ? '#B91C1C' : '#FECDCA',
      borderRadius: radii.sm,
      padding: spacing.sm,
      marginBottom: spacing.md,
      gap: spacing.xs,
    },
    errorIcon: {
      fontSize: 16,
    },
    serverErrorText: {
      flex: 1,
      color: theme.danger,
      fontSize: typography.sm,
      lineHeight: 18,
    },
    fieldGroup: {
      marginBottom: spacing.md,
    },
    label: {
      fontSize: typography.sm,
      fontWeight: '600',
      color: theme.text,
      marginBottom: spacing.xs,
    },
    requiredStar: {
      color: theme.danger,
    },
    readOnlyContainer: {
      backgroundColor: theme.surface,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    readOnlyText: {
      fontSize: typography.md,
      color: theme.text,
      fontWeight: '600',
    },
    readOnlyHelp: {
      fontSize: typography.xs,
      color: theme.textSecondary,
      marginTop: 4,
    },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: typography.md,
      color: theme.text,
    },
    inputError: {
      borderColor: theme.danger,
    },
    errorText: {
      color: theme.danger,
      fontSize: typography.xs,
      marginTop: 4,
    },
    roleTabsRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    roleTab: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: radii.md,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    roleTabActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    roleTabText: {
      fontSize: typography.sm,
      fontWeight: '500',
      color: theme.text,
    },
    roleTabTextActive: {
      color: theme.onPrimary,
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
      gap: spacing.xs,
    },
    noticeIcon: {
      fontSize: 18,
    },
    selfNoticeText: {
      flex: 1,
      fontSize: typography.sm,
      color: isDark ? '#38BDF8' : '#175CD3',
      lineHeight: 18,
    },
    sellerStatusContainer: {
      gap: spacing.xs,
    },
    statusOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: spacing.sm + 2,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statusOptionActive: {
      borderColor: theme.primary,
      backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#F0FBFC',
    },
    radioCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.textSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    radioCircleActive: {
      borderColor: theme.primary,
    },
    radioInnerCircle: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    statusOptionText: {
      fontSize: typography.sm,
      color: theme.text,
      fontWeight: '500',
    },
    statusOptionTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    saveButtonText: {
      color: theme.onPrimary,
      fontSize: typography.base,
      fontWeight: '700',
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonDisabled: {
      opacity: 0.5,
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
  });
