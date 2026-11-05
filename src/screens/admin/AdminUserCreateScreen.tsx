/**
 * Admin Portal — Create User Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Only authenticated users with Role.ADMIN can access.
 * 2. Real Backend Contract: POST /api/v1/admin/users
 * 3. Validation:
 *    - Email: required, valid format, max 255.
 *    - Password: required, 8..72 chars.
 *    - Name: required, max 255.
 *    - Role: required (CUSTOMER | SELLER | ADMIN).
 *    - Phone: optional Vietnamese mobile number format.
 *    - Address: optional, max 500 characters.
 *    - Enabled: optional boolean (defaults to true).
 * 4. Clear explanations:
 *    - If role is SELLER, indicates that the initial status will be PENDING.
 * 5. Security & Safety:
 *    - Never logs passwords.
 *    - Password visibility toggle.
 *    - Preserves entered form values on error.
 * 6. Accessibility labels and error display.
 * 7. Personalization: Theme-driven semantic styles & localized bilingual strings.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { radii, spacing, typography } from '../../constants/theme';
import { useCreateAdminUser } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { Role } from '../../types/auth';

type Props = AppNavigatorScreenProps<'AdminUserCreate'>;

const VIETNAMESE_PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;

export default function AdminUserCreateScreen({ navigation }: Props) {
  const { user: currentUser, isAuthenticated } = useAuth();
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const isAdmin = isAuthenticated && currentUser?.role === 'ADMIN';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [enabled, setEnabled] = useState(true);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const createMutation = useCreateAdminUser();

  const roleOptions: { role: Role; label: string; desc: string }[] = useMemo(
    () => [
      {
        role: 'CUSTOMER',
        label: t('admin.enums.role.customer', 'Customer'),
        desc: t('admin.users.create.roleDescCustomer', 'Shop and place orders on the platform'),
      },
      {
        role: 'SELLER',
        label: t('admin.enums.role.seller', 'Seller'),
        desc: t(
          'admin.users.create.roleDescSeller',
          'Open a shop and sell products (starts in Pending status)',
        ),
      },
      {
        role: 'ADMIN',
        label: t('admin.enums.role.admin', 'Admin'),
        desc: t('admin.users.create.roleDescAdmin', 'Full system administration rights'),
      },
    ],
    [t],
  );

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>
            {t('admin.users.create.unauthorizedTitle', 'Access denied')}
          </Text>
          <Text style={styles.unauthorizedMessage}>
            {t('admin.users.create.unauthorizedMessage', 'Only system administrators have permission to create users.')}
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t('admin.users.create.validation.emailRequired', 'Please enter an email address');
    } else if (!trimmedEmail.includes('@') || trimmedEmail.length > 255) {
      errors.email = t('admin.users.create.validation.emailInvalid', 'Invalid email');
    }

    if (!password) {
      errors.password = t('admin.users.create.validation.passwordRequired', 'Please enter a password');
    } else if (password.length < 8 || password.length > 72) {
      errors.password = t('admin.users.create.validation.passwordLength', 'Password must be 8 to 72 characters');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = t('admin.users.create.validation.nameRequired', 'Please enter your full name');
    } else if (trimmedName.length > 255) {
      errors.name = t('admin.users.create.validation.nameTooLong', 'Full name must be at most 255 characters');
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !VIETNAMESE_PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = t(
        'admin.users.create.validation.phoneInvalid',
        'Invalid Vietnamese mobile phone number (e.g. 0912345678)',
      );
    }

    if (address.length > 500) {
      errors.address = t('admin.users.create.validation.addressTooLong', 'Address must be at most 500 characters');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validateForm()) return;

    try {
      await createMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        role,
        enabled,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      Alert.alert(
        t('admin.users.create.successTitle', 'Success'),
        t('admin.users.create.successMsg', 'New user account created successfully.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setServerError(apiErr.message);
    }
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

          {/* Email field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.emailLabel', 'Email')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.email ? styles.inputError : null]}
              placeholder="user@example.com"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (formErrors.email) setFormErrors((p) => ({ ...p, email: '' }));
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              testID="create-email-input"
            />
            {formErrors.email ? (
              <Text style={styles.errorText}>{formErrors.email}</Text>
            ) : null}
          </View>

          {/* Password field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.passwordLabel', 'Initial password')}{' '}
              <Text style={styles.requiredStar}>
                * {t('admin.users.create.passwordHint', '(8-72 characters)')}
              </Text>
            </Text>
            <View style={[styles.passwordContainer, formErrors.password ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('admin.users.create.passwordPlaceholder', 'Enter password')}
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (formErrors.password) setFormErrors((p) => ({ ...p, password: '' }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                testID="create-password-input"
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={8}
                style={styles.eyeButton}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? t('admin.users.create.togglePasswordHide', 'Hide password')
                    : t('admin.users.create.togglePasswordShow', 'Show password')
                }
                testID="toggle-password-visibility"
              >
                <Text style={styles.eyeText}>
                  {showPassword
                    ? t('admin.users.create.togglePasswordHide', 'Hide')
                    : t('admin.users.create.togglePasswordShow', 'Show')}
                </Text>
              </Pressable>
            </View>
            {formErrors.password ? (
              <Text style={styles.errorText}>{formErrors.password}</Text>
            ) : null}
          </View>

          {/* Full Name field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.nameLabel', 'Full name')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.name ? styles.inputError : null]}
              placeholder={t('admin.users.create.namePlaceholder', 'John Doe')}
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (formErrors.name) setFormErrors((p) => ({ ...p, name: '' }));
              }}
              testID="create-name-input"
            />
            {formErrors.name ? (
              <Text style={styles.errorText}>{formErrors.name}</Text>
            ) : null}
          </View>

          {/* Role Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.roleLabel', 'Role')} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.roleOptionsContainer}>
              {roleOptions.map((item) => {
                const isSelected = role === item.role;
                return (
                  <Pressable
                    key={item.role}
                    style={[styles.roleCard, isSelected && styles.roleCardActive]}
                    onPress={() => setRole(item.role)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={item.label}
                    testID={`role-option-${item.role}`}
                  >
                    <View style={styles.roleHeader}>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected ? <View style={styles.radioInnerCircle} /> : null}
                      </View>
                      <Text style={[styles.roleTitle, isSelected && styles.roleTitleActive]}>
                        {item.label}
                      </Text>
                    </View>
                    <Text style={styles.roleDesc}>{item.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Phone field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.phoneLabel', 'Phone number (optional)')}
            </Text>
            <TextInput
              style={[styles.input, formErrors.phone ? styles.inputError : null]}
              placeholder="0912345678"
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (formErrors.phone) setFormErrors((p) => ({ ...p, phone: '' }));
              }}
              keyboardType="phone-pad"
              testID="create-phone-input"
            />
            {formErrors.phone ? (
              <Text style={styles.errorText}>{formErrors.phone}</Text>
            ) : null}
          </View>

          {/* Address field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {t('admin.users.create.addressLabel', 'Address (optional)')}
            </Text>
            <TextInput
              style={[styles.input, formErrors.address ? styles.inputError : null]}
              placeholder={t('admin.users.create.addressPlaceholder', 'Contact address')}
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (formErrors.address) setFormErrors((p) => ({ ...p, address: '' }));
              }}
              maxLength={500}
              testID="create-address-input"
            />
            {formErrors.address ? (
              <Text style={styles.errorText}>{formErrors.address}</Text>
            ) : null}
          </View>

          {/* Enabled switch */}
          <View style={styles.switchGroup}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>
                {t('admin.users.create.enabledLabel', 'Activate account immediately')}
              </Text>
              <Text style={styles.switchSubtext}>
                {t('admin.users.create.enabledSubtext', 'Account can log in immediately after creation')}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={theme.onPrimary}
              testID="create-enabled-switch"
            />
          </View>

          {/* Submit button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.buttonPressed,
              createMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('admin.users.create.submitBtn', 'Create user')}
            testID="submit-create-user-button"
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>
                {t('admin.users.create.submitBtn', 'Create user')}
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
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      fontSize: typography.md,
      color: theme.text,
    },
    eyeButton: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    eyeText: {
      fontSize: typography.sm,
      color: theme.primary,
      fontWeight: '600',
    },
    inputError: {
      borderColor: theme.danger,
    },
    errorText: {
      color: theme.danger,
      fontSize: typography.xs,
      marginTop: 4,
    },
    roleOptionsContainer: {
      gap: spacing.xs,
    },
    roleCard: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radii.md,
      padding: spacing.sm + 2,
    },
    roleCardActive: {
      borderColor: theme.primary,
      backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#F0FBFC',
    },
    roleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
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
    roleTitle: {
      fontSize: typography.md,
      fontWeight: '600',
      color: theme.text,
    },
    roleTitleActive: {
      color: theme.primary,
    },
    roleDesc: {
      fontSize: typography.xs,
      color: theme.textSecondary,
      marginLeft: 26,
      lineHeight: 16,
    },
    switchGroup: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: spacing.lg,
    },
    switchLabelContainer: {
      flex: 1,
      marginRight: spacing.md,
    },
    switchLabel: {
      fontSize: typography.md,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 2,
    },
    switchSubtext: {
      fontSize: typography.xs,
      color: theme.textSecondary,
    },
    submitButton: {
      backgroundColor: theme.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonText: {
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
