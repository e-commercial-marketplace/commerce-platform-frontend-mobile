/**
 * Edit-profile screen of the signed-in user (PATCH /users/me). Shared by Customer, Seller and Admin.
 * Email is display-only: the backend does not allow changing email, role or status through this API.
 * Integrated with UI Personalization (Theme & Language).
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
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser, useUpdateProfile } from '../hooks/useCurrentUser';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';

const NAME_MAX_LENGTH = 255;
const ADDRESS_MAX_LENGTH = 500;
// Same rule as the backend (VietnamesePhone): Vietnamese mobile number starting with 0 or +84.
const VIETNAMESE_PHONE = /^(0|\+84)[35789]\d{8}$/;

type ProfileFieldErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

export default function EditProfileScreen({ navigation }: AppNavigatorScreenProps<'EditProfile'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const { updateUserName } = useAuth();
  const { data: profile, isLoading, isError, refetch } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const submitting = updateProfile.isPending;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  // Fill the form only once so a later data refresh does not erase what the user is editing.
  useEffect(() => {
    if (profile != null && !filled) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
      setAddress(profile.address ?? '');
      setFilled(true);
    }
  }, [profile, filled]);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();
    const nextErrors: ProfileFieldErrors = {};

    if (trimmedName.length === 0) {
      nextErrors.name = t('profile.nameRequired', 'Name is required.');
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      nextErrors.name = t('profile.nameTooLong', `Name must be at most ${NAME_MAX_LENGTH} characters.`, { max: NAME_MAX_LENGTH });
    }
    if (trimmedPhone.length > 0 && !VIETNAMESE_PHONE.test(trimmedPhone)) {
      nextErrors.phone = t('profile.phoneInvalid', 'Enter a Vietnamese mobile number, for example 0912345678.');
    }
    if (trimmedAddress.length > ADDRESS_MAX_LENGTH) {
      nextErrors.address = t('profile.addressTooLong', `Address must be at most ${ADDRESS_MAX_LENGTH} characters.`, { max: ADDRESS_MAX_LENGTH });
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      // An empty string means clearing the phone number or address (per the contract).
      const updated = await updateProfile.mutateAsync({
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
      });
      updateUserName(updated.name);
      Alert.alert(t('profile.success', 'Success'), t('profile.profileUpdatedSuccess', 'Profile updated successfully.'));
      navigation.goBack();
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
      const fieldErrors = apiError.fieldErrors;
      if (fieldErrors != null) {
        setErrors({ name: fieldErrors.name, phone: fieldErrors.phone, address: fieldErrors.address });
      }
    }
  };

  if (isLoading && profile == null) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError && profile == null) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: theme.background }]} edges={['bottom']}>
        <Text style={[styles.formError, { color: theme.danger }]}>
          {t('profile.errorLoadingEditProfile', "Couldn't load your profile.")}
        </Text>
        <Pressable
          onPress={() => {
            void refetch();
          }}
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.retry', 'Retry')}
        >
          <Text style={[styles.submitButtonText, { color: theme.onPrimary }]}>
            {t('profile.retry', 'Retry')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.readOnlyBlock}>
            <Text style={[styles.readOnlyLabel, { color: theme.text }]}>
              {t('profile.emailLabel', 'Email')}
            </Text>
            <Text style={[styles.readOnlyValue, { color: theme.textSecondary }]}>{profile?.email}</Text>
          </View>

          <FormField
            label={t('profile.fullName', 'Full Name')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrors((previous) => ({ ...previous, name: undefined }));
              setFormError(null);
            }}
            placeholder={t('profile.namePlaceholder', 'Your full name')}
            error={errors.name}
            editable={!submitting}
            autoCapitalize="words"
          />

          <FormField
            label={t('profile.phone', 'Phone')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setErrors((previous) => ({ ...previous, phone: undefined }));
              setFormError(null);
            }}
            placeholder="0912345678"
            error={errors.phone}
            editable={!submitting}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <FormField
            label={t('profile.address', 'Address')}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setErrors((previous) => ({ ...previous, address: undefined }));
              setFormError(null);
            }}
            placeholder={t('profile.addressPlaceholder', 'Street, district, city')}
            error={errors.address}
            editable={!submitting}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleSubmit();
            }}
          />

          {formError != null && <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text>}

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
            accessibilityLabel={t('profile.saveChanges', 'Save Changes')}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={theme.onPrimary} size="small" />
                <Text style={[styles.submitButtonText, { color: theme.onPrimary }]}>
                  {t('profile.saving', 'Saving...')}
                </Text>
              </View>
            ) : (
              <Text style={[styles.submitButtonText, { color: theme.onPrimary }]}>
                {t('profile.saveChanges', 'Save Changes')}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  readOnlyBlock: {
    gap: spacing.xs,
  },
  readOnlyLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  readOnlyValue: {
    fontSize: 15,
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
  },
});
