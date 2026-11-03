/**
 * Authenticated password change screen (PATCH /users/me/password).
 * Delegates to AuthContext.changePassword which rotates and persists new session tokens.
 * Passwords are not trimmed to allow valid spaces/symbols per backend contract.
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

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

type ChangePasswordFieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ChangePasswordScreen({
  navigation,
}: AppNavigatorScreenProps<'ChangePassword'>) {
  const { changePassword } = useAuth();
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ChangePasswordFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    const nextErrors: ChangePasswordFieldErrors = {};

    if (currentPassword.length === 0) {
      nextErrors.currentPassword = t('auth.currentPasswordRequired', 'Current password is required.');
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
    } else if (currentPassword.length > 0 && newPassword === currentPassword) {
      nextErrors.newPassword = t(
        'auth.newPasswordDifferent',
        'New password must be different from current password.',
      );
    }

    if (confirmPassword.length === 0) {
      nextErrors.confirmPassword = t(
        'auth.confirmPasswordRequired',
        'Confirm your new password.',
      );
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
      await changePassword({
        currentPassword,
        newPassword,
      });

      // Clear local password state before navigating away
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        t('auth.passwordChangedTitle', 'Success'),
        t('auth.passwordChangedMessage', 'Password changed successfully.'),
      );
      navigation.goBack();
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);

      const fieldErrors = apiError.fieldErrors;
      if (fieldErrors != null) {
        setErrors((previous) => ({
          ...previous,
          currentPassword: fieldErrors.currentPassword ?? previous.currentPassword,
          newPassword: fieldErrors.newPassword ?? previous.newPassword,
        }));
      } else if (apiError.message.toLowerCase().includes('current password')) {
        setErrors((previous) => ({
          ...previous,
          currentPassword: apiError.message,
        }));
      } else if (apiError.message.toLowerCase().includes('different')) {
        setErrors((previous) => ({
          ...previous,
          newPassword: apiError.message,
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
      testID="change-password-screen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.intro, { color: theme.textSecondary }]}>
            {t(
              'auth.changePasswordIntro',
              'Enter your current password and choose a new password.',
            )}
          </Text>

          <FormField
            label={t('auth.currentPassword', 'Current Password')}
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              setErrors((previous) => ({ ...previous, currentPassword: undefined }));
              setFormError(null);
            }}
            placeholder={t('auth.currentPasswordPlaceholder', 'Your current password')}
            error={errors.currentPassword}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.newPassword', 'New Password')}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setErrors((previous) => ({ ...previous, newPassword: undefined }));
              setFormError(null);
            }}
            placeholder={t('auth.newPasswordPlaceholder', 'From 8 to 72 characters')}
            error={errors.newPassword}
            secureTextEntry
            editable={!submitting}
            autoCapitalize="none"
          />

          <FormField
            label={t('auth.confirmNewPassword', 'Confirm New Password')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrors((previous) => ({ ...previous, confirmPassword: undefined }));
              setFormError(null);
            }}
            placeholder={t(
              'auth.confirmNewPasswordChangePlaceholder',
              'Re-enter your new password',
            )}
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
            accessibilityLabel={t('auth.changePasswordTitle', 'Change Password')}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>
                  {t('auth.changingPassword', 'Changing password...')}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {t('auth.changePasswordTitle', 'Change Password')}
              </Text>
            )}
          </Pressable>
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
});
