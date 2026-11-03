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
 */

import React, { useState } from 'react';
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
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useCreateAdminUser } from '../../hooks/useAdmin';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { Role } from '../../types/auth';

type Props = AppNavigatorScreenProps<'AdminUserCreate'>;

const ROLE_OPTIONS: { role: Role; label: string; desc: string }[] = [
  { role: 'CUSTOMER', label: 'Customer', desc: 'Shop and place orders on the platform' },
  { role: 'SELLER', label: 'Seller', desc: 'Open a shop and sell products (starts in Pending status)' },
  { role: 'ADMIN', label: 'Admin', desc: 'Full system administration rights' },
];

const VIETNAMESE_PHONE_REGEX = /^(0|\+84)[35789]\d{8}$/;

export default function AdminUserCreateScreen({ navigation }: Props) {
  const { user: currentUser, isAuthenticated } = useAuth();
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

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedMessage}>
            Only system administrators can create users.
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Please enter an email address';
    } else if (!trimmedEmail.includes('@') || trimmedEmail.length > 255) {
      errors.email = 'Invalid email';
    }

    if (!password) {
      errors.password = 'Please enter a password';
    } else if (password.length < 8 || password.length > 72) {
      errors.password = 'Password must be 8 to 72 characters';
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Please enter your full name';
    } else if (trimmedName.length > 255) {
      errors.name = 'Full name must be at most 255 characters';
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !VIETNAMESE_PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = 'Invalid Vietnamese mobile phone number (e.g. 0912345678)';
    }

    if (address.length > 500) {
      errors.address = 'Address must be at most 500 characters';
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

      Alert.alert('Success', 'New user account created successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
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
              Email <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.email ? styles.inputError : null]}
              placeholder="user@example.com"
              placeholderTextColor={colors.textSecondary}
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
              Initial password <Text style={styles.requiredStar}>* (8-72 characters)</Text>
            </Text>
            <View style={[styles.passwordContainer, formErrors.password ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor={colors.textSecondary}
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
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                testID="toggle-password-visibility"
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
            {formErrors.password ? (
              <Text style={styles.errorText}>{formErrors.password}</Text>
            ) : null}
          </View>

          {/* Full Name field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Full name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, formErrors.name ? styles.inputError : null]}
              placeholder="John Doe"
              placeholderTextColor={colors.textSecondary}
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
              Role <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.roleOptionsContainer}>
              {ROLE_OPTIONS.map((item) => {
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
            <Text style={styles.label}>Phone number (optional)</Text>
            <TextInput
              style={[styles.input, formErrors.phone ? styles.inputError : null]}
              placeholder="0912345678"
              placeholderTextColor={colors.textSecondary}
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
            <Text style={styles.label}>Address (optional)</Text>
            <TextInput
              style={[styles.input, formErrors.address ? styles.inputError : null]}
              placeholder="Contact address"
              placeholderTextColor={colors.textSecondary}
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
              <Text style={styles.switchLabel}>Activate account immediately</Text>
              <Text style={styles.switchSubtext}>
                The account can sign in right after creation
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onPrimary}
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
            accessibilityLabel="Create user"
            testID="submit-create-user-button"
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>Create user</Text>
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.md,
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  eyeText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.xs,
    marginTop: 4,
  },
  roleOptionsContainer: {
    gap: spacing.xs,
  },
  roleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0FBFC',
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
  roleTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  roleTitleActive: {
    color: colors.primary,
  },
  roleDesc: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginLeft: 26,
    lineHeight: 16,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchLabel: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  switchSubtext: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
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
