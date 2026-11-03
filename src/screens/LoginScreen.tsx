/**
 * Sign-in form calling the real backend (POST /auth/login via AuthContext).
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 * Localized copy and frontend-owned validation error messages.
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
import { radii, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The backend enforces 8..72 characters for registration; reuse 8 here. */
const PASSWORD_MIN_LENGTH = 8;

type LoginFieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen({ navigation }: AppNavigatorScreenProps<'Login'>) {
  const { login } = useAuth();
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

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
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="login-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            {t('auth.signInToContinue', 'Sign in to continue.')}
          </Text>

          <FormField
            label={t('auth.email', 'Email')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors((previous) => ({ ...previous, email: undefined }));
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
              setErrors((previous) => ({ ...previous, password: undefined }));
            }}
            placeholder={t('auth.passwordPlaceholder', 'Your password')}
            error={errors.password}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          <View style={styles.forgotPasswordRow}>
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Forgot password?"
              accessibilityState={{ disabled: submitting }}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  { color: theme.primary },
                  submitting && styles.forgotPasswordTextDimmed,
                ]}
              >
                {t('auth.forgotPasswordQuestion', 'Forgot password?')}
              </Text>
            </Pressable>
          </View>

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
            accessibilityLabel="Log in"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>
                  {t('auth.loggingIn', 'Logging in...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>{t('auth.login', 'Login')}</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>
              {t('auth.noAccountQuestion', "Don't have an account? ")}
            </Text>
            <Pressable
              onPress={() => navigation.replace('Register')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
              accessibilityState={{ disabled: submitting }}
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: theme.primary },
                  submitting && styles.switchLinkDimmed,
                ]}
              >
                {t('auth.createOne', 'Create one')}
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
  formError: {
    fontSize: 13,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  forgotPasswordTextDimmed: {
    opacity: 0.5,
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
