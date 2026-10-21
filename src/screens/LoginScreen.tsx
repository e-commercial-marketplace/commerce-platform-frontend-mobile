/**
 * Sign-in form calling the real backend (POST /auth/login via AuthContext).
 * Validation mirrors the backend rules (email format, password min length);
 * the form is never submitted while invalid or while a request is running.
 * Backend messages (wrong credentials, network, ...) are shown inline.
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
/** The backend enforces 8..72 characters for registration; reuse 8 here. */
const PASSWORD_MIN_LENGTH = 8;

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen({ navigation }: AppNavigatorScreenProps<'Login'>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return; // ignore duplicate taps while the request is in flight
    }

    const nextErrors: LoginFieldErrors = {};
    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (password.length === 0) {
      nextErrors.password = 'Password is required.';
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      nextErrors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }

    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.email != null || nextErrors.password != null) {
      return; // never submit an invalid form
    }

    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      navigation.goBack(); // back to the Profile tab, now authenticated
    } catch (error) {
      const apiError = toApiError(error);
      setFormError(apiError.message);

      const fieldErrors = apiError.fieldErrors;
      if (fieldErrors != null) {
        setErrors((previous) => ({
          ...previous,
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
          <Text style={styles.intro}>Sign in to continue.</Text>

          <FormField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors((previous) => ({ ...previous, email: undefined }));
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
              setErrors((previous) => ({ ...previous, password: undefined }));
            }}
            placeholder="Your password"
            error={errors.password}
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
            accessibilityLabel="Log in"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.submitButtonText}>Logging in...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Login</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don&apos;t have an account? </Text>
            <Pressable
              onPress={() => navigation.replace('Register')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
              accessibilityState={{ disabled: submitting }}
            >
              <Text style={[styles.switchLink, submitting && styles.switchLinkDimmed]}>
                Create one
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
