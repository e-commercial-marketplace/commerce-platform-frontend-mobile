/**
 * Reset password using the 6-digit emailed code (POST /auth/password/reset).
 * Supports prefilled email from route params, code input restriction to 6 digits,
 * password bounds (8..72 chars), client-side confirmation check, and a 60s
 * resend cooldown timer.
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
import { colors, radii, spacing } from '../constants/theme';
import type { AppNavigatorScreenProps } from '../navigation/types';
import * as authService from '../services/authService';

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
      setErrors((previous) => ({ ...previous, email: 'Email is required to resend code.' }));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrors((previous) => ({ ...previous, email: 'Enter a valid email address.' }));
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      setErrors((previous) => ({ ...previous, email: 'Email must be at most 255 characters.' }));
      return;
    }

    setResending(true);
    setFormError(null);

    try {
      await authService.forgotPassword({ email: trimmedEmail });
      setCountdown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(
        'Reset Code Sent',
        'If eligible, a new reset code has been sent.',
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
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    } else if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      nextErrors.email = 'Email must be at most 255 characters.';
    }

    if (trimmedCode.length === 0) {
      nextErrors.code = 'Reset code is required.';
    } else if (trimmedCode.length !== CODE_LENGTH || !/^\d{6}$/.test(trimmedCode)) {
      nextErrors.code = 'Reset code must be exactly 6 digits.';
    }

    if (newPassword.length === 0) {
      nextErrors.newPassword = 'New password is required.';
    } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
      nextErrors.newPassword = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
      nextErrors.newPassword = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
    }

    if (confirmPassword.length === 0) {
      nextErrors.confirmPassword = 'Confirm your new password.';
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
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
        'Password Reset Successful',
        'Your password has been reset successfully. Please log in with your new password.',
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Enter your email, the 6-digit code received, and your new password.
          </Text>

          <FormField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors((previous) => ({ ...previous, email: undefined }));
            }}
            placeholder="you@example.com"
            error={errors.email}
            editable={!submitting && !resending}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label="6-Digit Reset Code"
            value={code}
            onChangeText={(text) => {
              const digitsOnly = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(digitsOnly);
              setErrors((previous) => ({ ...previous, code: undefined }));
            }}
            placeholder="123456"
            error={errors.code}
            editable={!submitting && !resending}
            keyboardType="number-pad"
          />

          <FormField
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setErrors((previous) => ({ ...previous, newPassword: undefined }));
            }}
            placeholder="At least 8 characters"
            error={errors.newPassword}
            secureTextEntry
            editable={!submitting && !resending}
            autoCapitalize="none"
          />

          <FormField
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors((previous) => ({ ...previous, confirmPassword: undefined }));
            }}
            placeholder="Re-enter new password"
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
                countdown > 0 ? `Resend code in ${countdown} seconds` : 'Resend code'
              }
              accessibilityState={{ disabled: countdown > 0 || resending || submitting }}
            >
              <Text
                style={[
                  styles.resendLink,
                  (countdown > 0 || resending || submitting) && styles.resendLinkDimmed,
                ]}
              >
                {resending
                  ? 'Sending code...'
                  : countdown > 0
                    ? `Resend code in ${countdown}s`
                    : 'Resend Code'}
              </Text>
            </Pressable>
          </View>

          {formError != null && <Text style={styles.formError}>{formError}</Text>}

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting || resending}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || submitting || resending) && styles.submitButtonDimmed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset Password"
            accessibilityState={{
              disabled: submitting || resending,
              busy: submitting,
            }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.submitButtonText}>Resetting password...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Reset Password</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Remember your password? </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={submitting || resending}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Return to Login"
              accessibilityState={{ disabled: submitting || resending }}
            >
              <Text style={[styles.switchLink, (submitting || resending) && styles.switchLinkDimmed]}>
                Return to Login
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
  resendRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  resendLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  resendLinkDimmed: {
    color: colors.textSecondary,
    opacity: 0.7,
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
