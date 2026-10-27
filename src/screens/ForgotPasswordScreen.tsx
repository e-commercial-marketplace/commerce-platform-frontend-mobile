/**
 * Request a 6-digit password reset code via email (POST /auth/password/forgot).
 * Enumeration-safe: whether the account exists or not, backend returns 200 OK.
 * Form never reveals account existence.
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
import { colors, radii, spacing } from '../constants/theme';
import type { AppNavigatorScreenProps } from '../navigation/types';
import * as authService from '../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 255;

export default function ForgotPasswordScreen({
  navigation,
}: AppNavigatorScreenProps<'ForgotPassword'>) {
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
      setError('Email is required.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX_LENGTH) {
      setError('Email must be at most 255 characters.');
      return;
    }

    setError(undefined);
    setFormError(null);
    setSubmitting(true);

    try {
      await authService.forgotPassword({ email: trimmedEmail });
      Alert.alert(
        'Reset Code Sent',
        'If an account is associated with this email, a 6-digit reset code has been sent.',
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Enter your account email to receive a 6-digit reset code.
          </Text>

          <FormField
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(undefined);
            }}
            placeholder="you@example.com"
            error={error}
            editable={!submitting}
            keyboardType="email-address"
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
            accessibilityLabel="Send Reset Code"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.submitButtonText}>Sending code...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Send Reset Code</Text>
            )}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Remember your password? </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={submitting}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Return to Login"
              accessibilityState={{ disabled: submitting }}
            >
              <Text style={[styles.switchLink, submitting && styles.switchLinkDimmed]}>
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
