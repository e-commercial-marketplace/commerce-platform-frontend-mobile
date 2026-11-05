/**
 * Registration form calling the real backend (POST /auth/register via
 * AuthContext). The payload matches RegisterRequest: the UI "Full Name"
 * becomes `name`, the service adds `role: CUSTOMER` (the backend rejects
 * ADMIN), and confirm-password is a UI-only check that is never sent.
 * On success the backend returns tokens, so the user is signed in directly.
 * Fully theme-aware and localized with i18n support.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../api/errors';
import FormField from '../components/FormField';
import { radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { Role } from '../types/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Backend @Size(min = 8, max = 72) on the registration password. */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

type RegisterFieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterScreen({ navigation }: AppNavigatorScreenProps<'Register'>) {
  const { register } = useAuth();
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [errors, setErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field: keyof RegisterFieldErrors) =>
    setErrors((previous) => ({ ...previous, [field]: undefined }));

  const handleSubmit = async () => {
    if (submitting) {
      return; // ignore duplicate taps while the request is in flight
    }

    const nextErrors: RegisterFieldErrors = {};

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();

    if (trimmedFullName.length === 0) {
      nextErrors.fullName = t('auth.fullNameRequired', 'Full name is required.');
    }

    if (trimmedEmail.length === 0) {
      nextErrors.email = t('auth.emailRequired', 'Email is required.');
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = t('auth.emailInvalid', 'Enter a valid email address.');
    }

    if (password.length === 0) {
      nextErrors.password = t('auth.passwordRequired', 'Password is required.');
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = t(
        'auth.passwordMinLength',
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = t(
        'auth.passwordMaxLength',
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
      );
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = t('auth.passwordsDoNotMatch', 'Passwords do not match.');
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      return; // never submit an invalid form
    }

    setSubmitting(true);
    try {
      await register({ name: trimmedFullName, email: trimmedEmail, password, role });
      if (role === 'SELLER') {
        Alert.alert(
          t('auth.sellerAccountCreatedTitle', 'Seller account created'),
          t(
            'auth.sellerAccountCreatedMessage',
            'Seller account created. Your seller access is pending admin approval.',
          ),
        );
      }
      navigation.goBack(); // back to the Profile tab, now authenticated
    } catch (error) {
      const apiError = toApiError(error);
      setFormError(apiError.message);

      const fieldErrors = apiError.fieldErrors;
      if (fieldErrors != null) {
        setErrors((previous) => ({
          ...previous,
          // The backend field for the display name is `name`.
          fullName: fieldErrors.name ?? previous.fullName,
          email: fieldErrors.email ?? previous.email,
          password: fieldErrors.password ?? previous.password,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="register-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            {t('auth.createAccountToGetStarted', 'Create an account to get started.')}
          </Text>

          <View style={styles.roleSection}>
            <Text style={[styles.roleLabel, { color: theme.text }]}>
              {t('auth.accountType', 'Account type')}
            </Text>
            <View style={styles.roleRow}>
              <Pressable
                onPress={() => setRole('CUSTOMER')}
                disabled={submitting}
                style={[
                  styles.roleOption,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  role === 'CUSTOMER' && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: role === 'CUSTOMER', disabled: submitting }}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: theme.text },
                    role === 'CUSTOMER' && styles.roleOptionTextSelected,
                  ]}
                >
                  {t('auth.customer', 'Customer')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setRole('SELLER')}
                disabled={submitting}
                style={[
                  styles.roleOption,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  role === 'SELLER' && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: role === 'SELLER', disabled: submitting }}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    { color: theme.text },
                    role === 'SELLER' && styles.roleOptionTextSelected,
                  ]}
                >
                  {t('auth.seller', 'Seller')}
                </Text>
              </Pressable>
            </View>
          </View>

          <FormField
            label={t('auth.fullName', 'Full Name')}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              clearError('fullName');
            }}
            placeholder={t('auth.fullNamePlaceholder', 'Nguyen Van A')}
            error={errors.fullName}
            editable={!submitting}
            autoCapitalize="words"
          />

          <FormField
            label={t('auth.email', 'Email')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError('email');
            }}
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            error={errors.email}
            editable={!submitting}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.password', 'Password')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError('password');
            }}
            placeholder={t('auth.registerPasswordPlaceholder', 'At least 8 characters')}
            error={errors.password}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.confirmPassword', 'Confirm Password')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              clearError('confirmPassword');
            }}
            placeholder={t('auth.confirmPasswordPlaceholder', 'Re-enter your password')}
            error={errors.confirmPassword}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          {formError != null && (
            <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text>
          )}

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.primary },
              (pressed || submitting) && styles.submitButtonDimmed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.register', 'Register')}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>
                  {t('auth.creatingAccount', 'Creating account...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>{t('auth.register', 'Register')}</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>
              {t('auth.alreadyHaveAccount', 'Already have an account? ')}
            </Text>
            <Pressable
              onPress={() => navigation.replace('Login')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={t('auth.logInInstead', 'Log in')}
              accessibilityState={{ disabled: submitting }}
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: theme.primary },
                  submitting && styles.switchLinkDimmed,
                ]}
              >
                {t('auth.logInInstead', 'Log in')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    fontSize: 14,
  },
  roleSection: {
    gap: spacing.sm,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleOptionTextSelected: {
    color: '#FFFFFF',
  },
  formError: {
    fontSize: 13,
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  submitButtonDimmed: {
    opacity: 0.8,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchLinkDimmed: {
    opacity: 0.5,
  },
});
