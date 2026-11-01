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
 */

import React, { useEffect, useState } from 'react';
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
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useAdminUserDetail, useUpdateAdminUser } from '../../hooks/useAdmin';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { Role } from '../../types/auth';
import type { AdminUserUpdateRequest, SellerStatus } from '../../types/adminApi';

type Props = AppNavigatorScreenProps<'AdminUserEdit'>;

const ROLE_OPTIONS: { role: Role; label: string }[] = [
  { role: 'CUSTOMER', label: 'Khách hàng' },
  { role: 'SELLER', label: 'Người bán' },
  { role: 'ADMIN', label: 'Quản trị viên' },
];

const SELLER_STATUS_OPTIONS: { status: SellerStatus; label: string }[] = [
  { status: 'PENDING', label: 'Chờ duyệt (PENDING)' },
  { status: 'APPROVED', label: 'Đã duyệt (APPROVED)' },
  { status: 'SUSPENDED', label: 'Tạm ngưng (SUSPENDED)' },
  { status: 'REJECTED', label: 'Từ chối (REJECTED)' },
];

const VIETNAMESE_PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;

export default function AdminUserEditScreen({ route, navigation }: Props) {
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

  const updateMutation = useUpdateAdminUser();

  const isSelf = user?.id === currentUser?.id;

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [sellerStatus, setSellerStatus] = useState<SellerStatus | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

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
          <Text style={styles.unauthorizedTitle}>Truy cập bị từ chối</Text>
          <Text style={styles.unauthorizedMessage}>
            Chỉ Quản trị viên hệ thống mới có quyền chỉnh sửa thông tin người dùng.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Text style={styles.backButtonText}>Quay lại</Text>
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
          <Text style={styles.loadingText}>Đang tải thông tin…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !user) {
    const errorMessage = error ? toApiError(error).message : 'Người dùng không tồn tại';
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Không thể tải thông tin</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Thử lại"
            testID="retry-button"
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Họ và tên không được để trống';
    } else if (trimmedName.length > 255) {
      errors.name = 'Họ và tên tối đa 255 ký tự';
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !VIETNAMESE_PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = 'Số điện thoại di động Việt Nam không hợp lệ (VD: 0912345678)';
    }

    if (address.length > 500) {
      errors.address = 'Địa chỉ tối đa 500 ký tự';
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
      Alert.alert('Thông báo', 'Không có thông tin nào thay đổi.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: user.id, payload });
      Alert.alert('Thành công', 'Đã cập nhật thông tin người dùng thành công.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setServerError(apiErr.message);
    }
  };

  const handleSavePress = () => {
    if (!validateForm()) return;

    // If role changed and not self, require explicit confirmation
    if (!isSelf && role !== user.role) {
      const oldRoleLabel = ROLE_OPTIONS.find((r) => r.role === user.role)?.label ?? user.role;
      const newRoleLabel = ROLE_OPTIONS.find((r) => r.role === role)?.label ?? role;

      Alert.alert(
        'Xác nhận thay đổi vai trò',
        `Vai trò của tài khoản sẽ thay đổi từ "${oldRoleLabel}" sang "${newRoleLabel}".\n\nBạn có chắc chắn muốn áp dụng thay đổi này không?`,
        [
          { text: 'Huỷ', style: 'cancel' },
          { text: 'Đồng ý', onPress: executeUpdate },
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
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyContainer}>
              <Text style={styles.readOnlyText}>{user.email}</Text>
              <Text style={styles.readOnlyHelp}>Email không thể thay đổi sau khi tạo</Text>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Họ và tên <Text style={styles.requiredStar}>*</Text>
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
              Vai trò <Text style={styles.requiredStar}>*</Text>
            </Text>
            {isSelf ? (
              <View style={styles.selfNoticeBox} testID="edit-self-role-notice">
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={styles.selfNoticeText}>
                  Bạn đang chỉnh sửa tài khoản của mình. Admin không thể tự đổi vai trò của chính mình.
                </Text>
              </View>
            ) : (
              <View style={styles.roleTabsRow}>
                {ROLE_OPTIONS.map((item) => {
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
                      accessibilityLabel={`Chọn vai trò ${item.label}`}
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
              <Text style={styles.label}>Trạng thái người bán (sellerStatus)</Text>
              <View style={styles.sellerStatusContainer}>
                {SELLER_STATUS_OPTIONS.map((item) => {
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
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={[styles.input, formErrors.phone ? styles.inputError : null]}
              placeholder="0912345678 (để trống để xóa)"
              placeholderTextColor={colors.textSecondary}
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
            <Text style={styles.label}>Địa chỉ</Text>
            <TextInput
              style={[styles.input, formErrors.address ? styles.inputError : null]}
              placeholder="Địa chỉ liên hệ (để trống để xóa)"
              placeholderTextColor={colors.textSecondary}
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
            accessibilityLabel="Lưu thay đổi"
            testID="submit-edit-user-button"
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
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
    color: colors.danger,
    fontSize: typography.sm,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  requiredStar: {
    color: colors.danger,
  },
  readOnlyContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: {
    fontSize: typography.md,
    color: colors.text,
    fontWeight: '600',
  },
  readOnlyHelp: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleTabText: {
    fontSize: typography.sm,
    fontWeight: '500',
    color: colors.text,
  },
  roleTabTextActive: {
    color: colors.onPrimary,
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
    gap: spacing.xs,
  },
  noticeIcon: {
    fontSize: 18,
  },
  selfNoticeText: {
    flex: 1,
    fontSize: typography.sm,
    color: '#175CD3',
    lineHeight: 18,
  },
  sellerStatusContainer: {
    gap: spacing.xs,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FBFC',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  statusOptionText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveButtonText: {
    color: colors.onPrimary,
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
});
