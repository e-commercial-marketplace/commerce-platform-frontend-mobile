/**
 * Request a 6-digit password reset code via email (POST /auth/password/forgot).
 * Enumeration-safe: whether the account exists or not, backend returns 200 OK.
 * Form never reveals account existence.
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
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import * as authService from '../services/authService';
import { useAppTheme } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 255;

export default function ForgotPasswordScreen({
  navigation,
}: AppNavigatorScreenProps<'ForgotPassword'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setError(t('auth.emailRequired', 'Email is required.'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError(t('auth.emailInvalid', 'Enter a valid email address.'));
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      setError(t('auth.emailMaxLength', 'Email must be at most 255 characters.'));
      return;
    }

    setError(undefined);
    setFormError(null);
    setSubmitting(true);

    try {
      await authService.forgotPassword({ email: trimmedEmail });
      Alert.alert(
        t('auth.resetCodeSentTitle', 'Reset Code Sent'),
        t(
          'auth.resetCodeSentMessage',
          'If an account is associated with this email, a 6-digit reset code has been sent.',
        ),
      );
      navigation.navigate('ResetPassword', { email: trimmedEmail });
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
      if (apiError.fieldErrors?.email != null) {
        setError(apiError.fieldErrors.email);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['bottom']}
      testID="forgot-password-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            {t(
              'auth.forgotPasswordInstruction',
              'Enter your account email to receive a 6-digit reset code.',
            )}
          </Text>

          <FormField
            label={t('auth.email', 'Email')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(undefined);
            }}
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            error={error}
            editable={!submitting}
            keyboardType="email-address"
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
            accessibilityLabel={t('auth.sendResetCode', 'Send Reset Code')}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>
                  {t('auth.sendingCode', 'Sending code...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {t('auth.sendResetCode', 'Send Reset Code')}
              </Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>
              {t('auth.rememberPasswordQuestion', 'Remember your password? ')}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={t('auth.returnToLogin', 'Return to Login')}
              accessibilityState={{ disabled: submitting }}
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: theme.primary },
                  submitting && styles.switchLinkDimmed,
                ]}
              >
                {t('auth.returnToLogin', 'Return to Login')}
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
