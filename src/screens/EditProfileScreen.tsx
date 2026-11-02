/**
 * Màn sửa hồ sơ của người đang đăng nhập (PATCH /users/me). Dùng chung cho Customer, Seller và Admin.
 * Email chỉ hiển thị: backend không cho đổi email, vai trò hay trạng thái qua API này.
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
import { useAuth } from '../hooks/useAuth';
import { useCurrentUser, useUpdateProfile } from '../hooks/useCurrentUser';
import type { AppNavigatorScreenProps } from '../navigation/types';

const NAME_MAX_LENGTH = 255;
const ADDRESS_MAX_LENGTH = 500;
// Cùng luật với backend (VietnamesePhone): số di động Việt Nam, bắt đầu bằng 0 hoặc +84.
const VIETNAMESE_PHONE = /^(0|\+84)[35789]\d{8}$/;

type ProfileFieldErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

export default function EditProfileScreen({ navigation }: AppNavigatorScreenProps<'EditProfile'>) {
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

  // Chỉ điền form một lần, để lần làm mới dữ liệu sau đó không xoá chữ người dùng đang sửa.
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
      nextErrors.name = 'Name is required.';
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      nextErrors.name = `Name must be at most ${NAME_MAX_LENGTH} characters.`;
    }
    if (trimmedPhone.length > 0 && !VIETNAMESE_PHONE.test(trimmedPhone)) {
      nextErrors.phone = 'Enter a Vietnamese mobile number, for example 0912345678.';
    }
    if (trimmedAddress.length > ADDRESS_MAX_LENGTH) {
      nextErrors.address = `Address must be at most ${ADDRESS_MAX_LENGTH} characters.`;
    }

    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      // Chuỗi rỗng nghĩa là xoá số điện thoại hoặc địa chỉ (theo contract).
      const updated = await updateProfile.mutateAsync({
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
      });
      updateUserName(updated.name);
      Alert.alert('Success', 'Profile updated successfully.');
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
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError && profile == null) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <Text style={styles.formError}>Couldn&apos;t load your profile.</Text>
        <Pressable
          onPress={() => {
            void refetch();
          }}
          style={styles.submitButton}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.submitButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.readOnlyBlock}>
            <Text style={styles.readOnlyLabel}>Email</Text>
            <Text style={styles.readOnlyValue}>{profile?.email}</Text>
          </View>

          <FormField
            label="Full Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrors((previous) => ({ ...previous, name: undefined }));
              setFormError(null);
            }}
            placeholder="Your full name"
            error={errors.name}
            editable={!submitting}
            autoCapitalize="words"
          />

          <FormField
            label="Phone"
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
            label="Address"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setErrors((previous) => ({ ...previous, address: undefined }));
              setFormError(null);
            }}
            placeholder="Street, district, city"
            error={errors.address}
            editable={!submitting}
            autoCapitalize="sentences"
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
            accessibilityLabel="Save Changes"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <View style={styles.submitRow}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.submitButtonText}>Saving...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Save Changes</Text>
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
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  readOnlyValue: {
    fontSize: 15,
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
});
