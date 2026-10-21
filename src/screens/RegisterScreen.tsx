/**
 * Registration form calling the real backend (POST /auth/register via
 * AuthContext). The payload matches RegisterRequest: the UI "Full Name"
 * becomes `name`, the service adds `role: CUSTOMER` (the backend rejects
 * ADMIN), and confirm-password is a UI-only check that is never sent.
 * On success the backend returns tokens, so the user is signed in directly.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
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
import { colors, radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import type { AppNavigatorScreenProps } from '../navigation/types';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      nextErrors.fullName = 'Full name is required.';
    }

    if (trimmedEmail.length === 0) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (password.length === 0) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      return; // never submit an invalid form
    }

    setSubmitting(true);
    try {
      await register({ name: trimmedFullName, email: trimmedEmail, password });
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Create an account to get started.</Text>

          <FormField
            label="Full Name"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              clearError('fullName');
            }}
            placeholder="Nguyen Van A"
            error={errors.fullName}
            editable={!submitting}
            autoCapitalize="words"
          />

          <FormField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError('email');
            }}
            placeholder="you@example.com"
            error={errors.email}
            editable={!submitting}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError('password');
            }}
            placeholder="At least 8 characters"
            error={errors.password}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />

          <FormField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              clearError('confirmPassword');
            }}
            placeholder="Re-enter your password"
            error={errors.confirmPassword}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          {formError != null && <Text style={styles.formError}>{formError}</Text>}

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || submitting) && styles.submitButtonDimmed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.submitButtonText}>Creating account...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Register</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Pressable
              onPress={() => navigation.replace('Login')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Log in instead"
              accessibilityState={{ disabled: submitting }}
            >
              <Text style={[styles.switchLink, submitting && styles.switchLinkDimmed]}>
                Log in
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
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  formError: {
    fontSize: 13,
    color: colors.danger,
  },
  submitButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
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
    color: colors.onPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  switchText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  switchLinkDimmed: {
    opacity: 0.5,
  },
});
