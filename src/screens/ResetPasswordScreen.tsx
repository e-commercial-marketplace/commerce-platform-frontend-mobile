/**
 * Reset password using the 6-digit emailed code (POST /auth/password/reset).
 * Supports prefilled email from route params, code input restriction to 6 digits,
 * password bounds (8..72 chars), client-side confirmation check, and a 60s
 * resend cooldown timer.
 * Fully theme-aware and localized with i18n support.
 */

import { useEffect, useState } from 'react';
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
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

type ResetFieldErrors = {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ResetPasswordScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'ResetPassword'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const initialEmail = route.params?.email ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ResetFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  // If navigated with an email, start the 60-second cooldown timer
  const [countdown, setCountdown] = useState(
    initialEmail.length > 0 ? RESEND_COOLDOWN_SECONDS : 0,
  );

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCountdown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0 || resending || submitting) {
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setErrors((previous) => ({
        ...previous,
        email: t('auth.emailRequiredForResend', 'Email is required to resend code.'),
      }));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrors((previous) => ({
        ...previous,
        email: t('auth.emailInvalid', 'Enter a valid email address.'),
      }));
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      setErrors((previous) => ({
        ...previous,
        email: t('auth.emailMaxLength', 'Email must be at most 255 characters.'),
      }));
      return;
    }

    setResending(true);
    setFormError(null);

    try {
      await authService.forgotPassword({ email: trimmedEmail });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(
        t('auth.resetCodeSentTitle', 'Reset Code Sent'),
        t('auth.resetCodeSentAgainMessage', 'If eligible, a new reset code has been sent.'),
      );
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || resending) {
      return;
    }

    const nextErrors: ResetFieldErrors = {};
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (trimmedEmail.length === 0) {
      nextErrors.email = t('auth.emailRequired', 'Email is required.');
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = t('auth.emailInvalid', 'Enter a valid email address.');
    } else if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      nextErrors.email = t('auth.emailMaxLength', 'Email must be at most 255 characters.');
    }

    if (trimmedCode.length === 0) {
      nextErrors.code = t('auth.resetCodeRequired', 'Reset code is required.');
    } else if (trimmedCode.length !== CODE_LENGTH || !/^\d{6}$/.test(trimmedCode)) {
      nextErrors.code = t('auth.resetCodeLength', 'Reset code must be exactly 6 digits.');
    }

    if (newPassword.length === 0) {
      nextErrors.newPassword = t('auth.newPasswordRequired', 'New password is required.');
    } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
      nextErrors.newPassword = t(
        'auth.passwordMinLength',
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
      nextErrors.newPassword = t(
        'auth.passwordMaxLength',
        `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
      );
    }

    if (confirmPassword.length === 0) {
      nextErrors.confirmPassword = t('auth.confirmPasswordRequired', 'Confirm your new password.');
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = t('auth.passwordsDoNotMatch', 'Passwords do not match.');
    }

    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await authService.resetPassword({
        email: trimmedEmail,
        code: trimmedCode,
        newPassword,
      });

      Alert.alert(
        t('auth.passwordResetSuccessTitle', 'Password Reset Successful'),
        t(
          'auth.passwordResetSuccessMessage',
          'Your password has been reset successfully. Please log in with your new password.',
        ),
      );
      navigation.navigate('Login');
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);

      const fieldErrors = apiError.fieldErrors;
      if (fieldErrors != null) {
        setErrors((previous) => ({
          ...previous,
          email: fieldErrors.email ?? previous.email,
          code: fieldErrors.code ?? previous.code,
          newPassword: fieldErrors.newPassword ?? previous.newPassword,
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
      testID="reset-password-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            {t(
              'auth.resetPasswordInstruction',
              'Enter your email, the 6-digit code received, and your new password.',
            )}
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
            editable={!submitting && !resending}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.sixDigitResetCode', '6-Digit Reset Code')}
            value={code}
            onChangeText={(text) => {
              const digitsOnly = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(digitsOnly);
              setErrors((previous) => ({ ...previous, code: undefined }));
            }}
            placeholder={t('auth.codePlaceholder', '123456')}
            error={errors.code}
            editable={!submitting && !resending}
            keyboardType="number-pad"
          />

          <FormField
            label={t('auth.newPassword', 'New Password')}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setErrors((previous) => ({ ...previous, newPassword: undefined }));
            }}
            placeholder={t('auth.registerPasswordPlaceholder', 'At least 8 characters')}
            error={errors.newPassword}
            secureTextEntry
            editable={!submitting && !resending}
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.confirmNewPassword', 'Confirm New Password')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors((previous) => ({ ...previous, confirmPassword: undefined }));
            }}
            placeholder={t('auth.confirmNewPasswordPlaceholder', 'Re-enter new password')}
            error={errors.confirmPassword}
            secureTextEntry
            editable={!submitting && !resending}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          <View style={styles.resendRow}>
            <Pressable
              onPress={() => {
                void handleResend();
              }}
              disabled={countdown > 0 || resending || submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={
                countdown > 0
                  ? t('auth.resendCodeInSeconds', `Resend code in ${countdown} seconds`, {
                      seconds: countdown,
                    })
                  : t('auth.resendCode', 'Resend code')
              }
              accessibilityState={{ disabled: countdown > 0 || resending || submitting }}
            >
              <Text
                style={[
                  styles.resendLink,
                  { color: theme.primary },
                  (countdown > 0 || resending || submitting) && styles.resendLinkDimmed,
                ]}
              >
                {resending
                  ? t('auth.sendingCode', 'Sending code...')
                  : countdown > 0
                    ? t('auth.resendCodeIn', `Resend code in ${countdown}s`, { seconds: countdown })
                    : t('auth.resendCode', 'Resend Code')}
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
            disabled={submitting || resending}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.primary },
              (pressed || submitting || resending) && styles.submitButtonDimmed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.resetPasswordTitle', 'Reset Password')}
            accessibilityState={{
              disabled: submitting || resending,
              busy: submitting,
            }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>
                  {t('auth.resettingPassword', 'Resetting password...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {t('auth.resetPasswordTitle', 'Reset Password')}
              </Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>
              {t('auth.rememberPasswordQuestion', 'Remember your password? ')}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={submitting || resending}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={t('auth.returnToLogin', 'Return to Login')}
              accessibilityState={{ disabled: submitting || resending }}
            >
              <Text
                style={[
                  styles.switchLink,
                  { color: theme.primary },
                  (submitting || resending) && styles.switchLinkDimmed,
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
  resendRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendLinkDimmed: {
    opacity: 0.5,
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
