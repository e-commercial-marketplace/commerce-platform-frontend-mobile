/**
 * Admin Portal — Platform Voucher Management Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Authenticated users with Role.ADMIN only.
 * 2. Backend Contract & Model Truth:
 *    - Platform vouchers only (no seller vouchers, no carrier vouchers).
 *    - Primary key & identifier: `code` (string, max 64 chars, normalized to uppercase).
 *    - Discount type: Strictly percentage (`discountPercent`, 1..100).
 *    - Usage tracking: `timesUsed` (int >= 0) and `usageLimit` (int >= 1).
 *    - Validity: `validFrom` (Instant) and `validTo` (Instant).
 * 3. Status Derivation:
 *    - Backend does not store an active boolean.
 *    - Presentation accurately derives state from validity window and usage count:
 *      * NOT_YET_VALID: now < validFrom
 *      * EXPIRED: now >= validTo
 *      * USAGE_LIMIT_REACHED: timesUsed >= usageLimit
 *      * ACTIVE: validFrom <= now < validTo and timesUsed < usageLimit
 * 4. Create Voucher: POST /api/v1/admin/vouchers
 * 5. Update Voucher: PATCH /api/v1/admin/vouchers/{code}
 *    - Code is immutable.
 *    - If timesUsed > 0, discountPercent cannot be changed (backend restriction).
 *    - usageLimit cannot be below timesUsed.
 * 6. Expire Voucher: DELETE /api/v1/admin/vouchers/{code}
 *    - Soft expiration (sets validTo = now to preserve audit trail).
 *    - Accurately labeled "Ngừng phát hành" / "Hết hạn ngay".
 * 7. Multi-cache Synchronization:
 *    - Invalidates admin voucher list and customer checkout voucher cache.
 * 8. Personalization: Theme tokens (light/dark mode) and localized strings (vi/en).
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  useAdminVouchers,
  useCreateAdminVoucher,
  useExpireAdminVoucher,
  useUpdateAdminVoucher,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { VoucherResponse } from '../../types/voucherApi';
import {
  getVoucherStatusBadgeConfig,
  type VoucherDerivedStatus,
} from '../../utils/adminPresentation';

type Props = AppNavigatorScreenProps<'AdminVoucher'>;

const PAGE_SIZE = 20;

export type { VoucherDerivedStatus };

export function getVoucherDerivedStatus(
  voucher: VoucherResponse,
  now: Date = new Date(),
): VoucherDerivedStatus {
  const from = new Date(voucher.validFrom);
  const to = new Date(voucher.validTo);

  if (now < from) {
    return 'NOT_YET_VALID';
  }
  if (now >= to) {
    return 'EXPIRED';
  }
  if (voucher.timesUsed >= voucher.usageLimit) {
    return 'USAGE_LIMIT_REACHED';
  }
  return 'ACTIVE';
}

export function formatDateTimeDisplay(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoStr || '';
  }
}

export default function AdminVoucherScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  const [page, setPage] = useState(0);

  // Queries & Mutations
  const {
    data: voucherPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useAdminVouchers({ page, size: PAGE_SIZE }, isAdmin);

  const createMutation = useCreateAdminVoucher();
  const updateMutation = useUpdateAdminVoucher();
  const expireMutation = useExpireAdminVoucher();

  // Create Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createDiscountPercent, setCreateDiscountPercent] = useState('10');
  const [createUsageLimit, setCreateUsageLimit] = useState('100');
  const [createValidFrom, setCreateValidFrom] = useState(() => new Date().toISOString());
  const [createValidTo, setCreateValidTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form State
  const [editingVoucher, setEditingVoucher] = useState<VoucherResponse | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState('');
  const [editUsageLimit, setEditUsageLimit] = useState('');
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editValidTo, setEditValidTo] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={['bottom', 'left', 'right']}
      >
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.unauthorizedTitle, { color: theme.text }]}>
            {t('admin.portal.unauthorizedTitle', 'Access denied')}
          </Text>
          <Text style={[styles.unauthorizedMessage, { color: theme.textSecondary }]}>
            {t('admin.vouchers.unauthorizedAdminOnly', 'Only system administrators have permission to manage platform-wide discount vouchers.')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('admin.portal.backButton', 'Go back')}
          >
            <Text style={styles.backButtonText}>
              {t('admin.portal.backButton', 'Go back')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Quick Preset Helper for Dates
  const applyDatePreset = (
    days: number,
    setterFrom: (val: string) => void,
    setterTo: (val: string) => void,
  ) => {
    const now = new Date();
    const future = new Date(now);
    future.setDate(now.getDate() + days);
    setterFrom(now.toISOString());
    setterTo(future.toISOString());
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const now = new Date();
    const future = new Date(now);
    future.setDate(now.getDate() + 30);

    setCreateCode('');
    setCreateDescription('');
    setCreateDiscountPercent('10');
    setCreateUsageLimit('100');
    setCreateValidFrom(now.toISOString());
    setCreateValidTo(future.toISOString());
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (createMutation.isPending) return;
    setIsCreateModalOpen(false);
    setCreateError(null);
  };

  const handleSubmitCreate = async () => {
    const trimmedCode = createCode.trim().toUpperCase();
    if (!trimmedCode) {
      setCreateError(t('admin.vouchers.validation.codeRequired', 'Please enter the voucher code.'));
      return;
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmedCode)) {
      setCreateError(
        t(
          'admin.vouchers.validation.codeInvalid',
          'The voucher code may only contain letters, digits, hyphens (-) and underscores (_), up to 64 characters.',
        ),
      );
      return;
    }

    const discountNum = parseInt(createDiscountPercent, 10);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 100) {
      setCreateError(
        t('admin.vouchers.validation.discountRange', 'The discount rate must be an integer from 1% to 100%.'),
      );
      return;
    }

    const usageLimitNum = parseInt(createUsageLimit, 10);
    if (isNaN(usageLimitNum) || usageLimitNum < 1) {
      setCreateError(t('admin.vouchers.validation.limitMin', 'The usage limit must be 1 or more.'));
      return;
    }

    const fromDate = new Date(createValidFrom);
    const toDate = new Date(createValidTo);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setCreateError(t('admin.vouchers.validation.dateInvalid', 'The validity period is invalid.'));
      return;
    }
    if (fromDate >= toDate) {
      setCreateError(
        t(
          'admin.vouchers.validation.dateOrder',
          'The start time (validFrom) must be before the end time (validTo).',
        ),
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        code: trimmedCode,
        description: createDescription.trim() || null,
        discountPercent: discountNum,
        validFrom: fromDate.toISOString(),
        validTo: toDate.toISOString(),
        usageLimit: usageLimitNum,
      });

      setIsCreateModalOpen(false);
      setCreateError(null);
      Alert.alert(
        t('admin.common.success', 'Success'),
        t('admin.vouchers.createSuccess', `Created voucher "${trimmedCode}" successfully.`, {
          code: trimmedCode,
        }),
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combined = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (combined.includes('already exists') || combined.includes('trùng')) {
        setCreateError(
          t(
            'admin.vouchers.validation.codeExists',
            `Voucher code "${trimmedCode}" already exists. Please choose another code.`,
            { code: trimmedCode },
          ),
        );
      } else {
        setCreateError(
          rawMsg ||
            apiError.message ||
            t('admin.vouchers.validation.createFailed', 'Could not create the voucher. Please try again.'),
        );
      }
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (voucher: VoucherResponse) => {
    setEditingVoucher(voucher);
    setEditDescription(voucher.description || '');
    setEditDiscountPercent(String(voucher.discountPercent));
    setEditUsageLimit(String(voucher.usageLimit));
    setEditValidFrom(voucher.validFrom);
    setEditValidTo(voucher.validTo);
    setEditError(null);
  };

  const handleCloseEditModal = () => {
    if (updateMutation.isPending) return;
    setEditingVoucher(null);
    setEditError(null);
  };

  const handleSubmitEdit = async () => {
    if (!editingVoucher) return;

    const discountNum = parseInt(editDiscountPercent, 10);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 100) {
      setEditError(
        t('admin.vouchers.validation.discountRange', 'The discount rate must be from 1% to 100%.'),
      );
      return;
    }

    // Backend constraint: if timesUsed > 0, discountPercent cannot change
    if (editingVoucher.timesUsed > 0 && discountNum !== editingVoucher.discountPercent) {
      setEditError(
        t('admin.vouchers.lockedDiscountNote', 'This code has already been used, so the discount percentage cannot be changed according to system rules.'),
      );
      return;
    }

    const usageLimitNum = parseInt(editUsageLimit, 10);
    if (isNaN(usageLimitNum) || usageLimitNum < 1) {
      setEditError(t('admin.vouchers.validation.limitMin', 'The usage limit must be 1 or more.'));
      return;
    }
    if (usageLimitNum < editingVoucher.timesUsed) {
      setEditError(
        t(
          'admin.vouchers.validation.limitBelowUsed',
          `The usage limit cannot be lower than the number of uses so far (${editingVoucher.timesUsed}).`,
          { used: editingVoucher.timesUsed },
        ),
      );
      return;
    }

    const fromDate = new Date(editValidFrom);
    const toDate = new Date(editValidTo);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setEditError(t('admin.vouchers.validation.dateInvalid', 'The validity period is invalid.'));
      return;
    }
    if (fromDate >= toDate) {
      setEditError(
        t(
          'admin.vouchers.validation.dateOrder',
          'The start time (validFrom) must be before the end time (validTo).',
        ),
      );
      return;
    }

    try {
      await updateMutation.mutateAsync({
        code: editingVoucher.code,
        payload: {
          description: editDescription.trim() || null,
          discountPercent: discountNum,
          usageLimit: usageLimitNum,
          validFrom: fromDate.toISOString(),
          validTo: toDate.toISOString(),
        },
      });

      setEditingVoucher(null);
      setEditError(null);
      Alert.alert(
        t('admin.common.success', 'Success'),
        t('admin.vouchers.updateSuccess', `Updated voucher "${editingVoucher.code}".`, {
          code: editingVoucher.code,
        }),
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      setEditError(
        rawMsg ||
          apiError.message ||
          t('admin.vouchers.validation.updateFailed', 'Could not update the voucher. Please try again.'),
      );
    }
  };

  // Handle Expire / Deactivate
  const handleExpirePress = (voucher: VoucherResponse) => {
    Alert.alert(
      t('admin.vouchers.expireConfirmTitle', 'Stop issuing voucher'),
      t(
        'admin.vouchers.expireConfirmMsg',
        `Are you sure you want to stop issuing voucher "${voucher.code}" right away? The voucher will expire and customers can no longer apply it to new orders.`,
        { code: voucher.code },
      ),
      [
        { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.vouchers.expireConfirmBtn', 'Confirm stop'),
          style: 'destructive',
          onPress: async () => {
            try {
              await expireMutation.mutateAsync(voucher.code);
              Alert.alert(
                t('admin.common.success', 'Success'),
                t('admin.vouchers.expireSuccess', `Stopped issuing voucher "${voucher.code}".`, {
                  code: voucher.code,
                }),
              );
            } catch (err: unknown) {
              const rawMsg = err instanceof Error ? err.message : '';
              const apiError = toApiError(err);
              Alert.alert(
                t('admin.common.error', 'Error'),
                rawMsg ||
                  apiError.message ||
                  t('admin.vouchers.validation.expireFailed', 'Could not stop issuing the voucher.'),
              );
            }
          },
        },
      ],
    );
  };

  const dynamicStyles = useMemo(
    () => ({
      codeBadgeBg: isDark ? 'rgba(8, 184, 204, 0.15)' : '#F0F5FF',
      codeBadgeBorder: isDark ? 'rgba(8, 184, 204, 0.3)' : '#D0E0FF',
      discountColor: isDark ? '#FB923C' : '#E04F16',
      editBtnBg: isDark ? 'rgba(8, 184, 204, 0.15)' : '#F0F5FF',
      expireBtnBg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF3F2',
      expireBtnBorder: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FDA29B',
      expireBtnText: isDark ? '#FCA5A5' : '#B42318',
      presetChipBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#EFF8FF',
      presetChipBorder: isDark ? 'rgba(56, 189, 248, 0.3)' : '#B2DDFF',
      presetChipText: isDark ? '#38BDF8' : '#175CD3',
    }),
    [isDark],
  );

  const renderItem = ({ item }: { item: VoucherResponse }) => {
    const status = getVoucherDerivedStatus(item);
    const statusConfig = getVoucherStatusBadgeConfig(status, t, isDark);
    const isExpired = status === 'EXPIRED';

    return (
      <View
        style={[
          styles.voucherCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        testID={`admin-voucher-card-${item.code}`}
      >
        {/* Header row: Code + Status */}
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.codeBadge,
              {
                backgroundColor: dynamicStyles.codeBadgeBg,
                borderColor: dynamicStyles.codeBadgeBorder,
              },
            ]}
          >
            <Text
              style={[styles.codeText, { color: theme.primary }]}
              testID={`admin-voucher-code-${item.code}`}
            >
              {item.code}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}
            testID={`admin-voucher-status-${item.code}`}
          >
            <Text style={[styles.statusBadgeText, { color: statusConfig.textColor }]}>
              {statusConfig.icon ? `${statusConfig.icon} ` : ''}
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Discount Tag */}
        <View style={styles.discountRow}>
          <Text style={[styles.discountTagText, { color: dynamicStyles.discountColor }]}>
            {t('admin.vouchers.discountTag', `🏷️ Discount ${item.discountPercent}%`, {
              percent: item.discountPercent,
            })}
          </Text>
        </View>

        {/* Description */}
        {item.description ? (
          <Text style={[styles.descriptionText, { color: theme.text }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Usage Stats */}
        <View style={styles.infoRow} testID={`admin-voucher-usage-${item.code}`}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
            {t('admin.vouchers.timesUsedLabel', 'Usage:')}
          </Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>
            {t(
              'admin.vouchers.timesUsedValue',
              `${item.timesUsed} / ${item.usageLimit} uses (${Math.min(100, Math.round((item.timesUsed / item.usageLimit) * 100))}%)`,
              {
                used: item.timesUsed,
                limit: item.usageLimit,
                percent: Math.min(100, Math.round((item.timesUsed / item.usageLimit) * 100)),
              },
            )}
          </Text>
        </View>

        {/* Validity Period */}
        <View style={styles.infoRow} testID={`admin-voucher-validity-${item.code}`}>
          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
            {t('admin.vouchers.validityLabel', 'Validity period:')}
          </Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>
            {formatDateTimeDisplay(item.validFrom)} - {formatDateTimeDisplay(item.validTo)}
          </Text>
        </View>

        {/* Actions row */}
        <View style={[styles.cardActionsRow, { borderTopColor: theme.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                borderColor: theme.primary,
                backgroundColor: dynamicStyles.editBtnBg,
              },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleOpenEditModal(item)}
            accessibilityRole="button"
            accessibilityLabel={t('admin.vouchers.editBtn', '✏️ Edit')}
            testID={`admin-voucher-edit-btn-${item.code}`}
          >
            <Text style={[styles.editButtonText, { color: theme.primary }]}>
              {t('admin.vouchers.editBtn', '✏️ Edit')}
            </Text>
          </Pressable>

          {!isExpired ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                {
                  borderColor: dynamicStyles.expireBtnBorder,
                  backgroundColor: dynamicStyles.expireBtnBg,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleExpirePress(item)}
              accessibilityRole="button"
              accessibilityLabel={t('admin.vouchers.expireBtn', '⏹️ Stop issuing')}
              testID={`admin-voucher-expire-btn-${item.code}`}
            >
              <Text style={[styles.expireButtonText, { color: dynamicStyles.expireBtnText }]}>
                {t('admin.vouchers.expireBtn', '⏹️ Stop issuing')}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.expiredBadge}>
              <Text style={[styles.expiredBadgeText, { color: theme.textSecondary }]}>
                {t('admin.vouchers.expiredBadge', 'Ended')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const vouchersList = voucherPage?.content ?? [];
  const totalPages = voucherPage?.totalPages ?? 1;
  const totalElements = voucherPage?.totalElements ?? 0;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['bottom', 'left', 'right']}
    >
      {/* Top Bar */}
      <View
        style={[
          styles.topContainer,
          {
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.topTextGroup}>
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {t('admin.vouchers.title', 'Platform-wide vouchers')}
          </Text>
          <Text style={[styles.topSubtitle, { color: theme.textSecondary }]}>
            {t(
              'admin.vouchers.subtitle',
              `${totalElements} vouchers • Applies to orders across the whole platform`,
              { count: totalElements },
            )}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: theme.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleOpenCreateModal}
          accessibilityRole="button"
          accessibilityLabel={t('admin.vouchers.createBtn', '＋ Create voucher')}
          testID="admin-voucher-create-btn"
        >
          <Text style={styles.createButtonText}>
            {t('admin.vouchers.createBtn', '＋ Create voucher')}
          </Text>
        </Pressable>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-voucher-loading">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('admin.vouchers.loading', 'Loading vouchers...')}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-voucher-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('admin.vouchers.errorTitle', 'Could not load the voucher list')}
          </Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            {t(
              'admin.vouchers.errorMessage',
              'Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại.',
            )}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('admin.common.actions.retry', 'Retry')}
            testID="admin-voucher-retry-btn"
          >
            <Text style={styles.retryButtonText}>
              {t('admin.common.actions.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      ) : vouchersList.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-voucher-empty">
          <Text style={styles.emptyIcon}>🎟️</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('admin.vouchers.emptyTitle', 'No vouchers yet')}
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
            {t(
              'admin.vouchers.emptyMessage',
              'Chưa có voucher nào được phát hành. Nhấn "Tạo voucher" để thiết lập mã giảm giá đầu tiên.',
            )}
          </Text>
        </View>
      ) : (
        <FlatList
          data={vouchersList}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          testID="admin-voucher-list"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View
                style={[styles.paginationRow, { borderTopColor: theme.border }]}
                testID="admin-voucher-pagination"
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.pageButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                    page === 0 && styles.pageButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.prev', '‹ Trang trước')}
                  testID="admin-voucher-prev-page-btn"
                >
                  <Text style={[styles.pageButtonText, { color: theme.text }]}>
                    {t('admin.common.actions.prev', '‹ Trang trước')}
                  </Text>
                </Pressable>

                <Text
                  style={[styles.pageInfoText, { color: theme.textSecondary }]}
                  testID="admin-voucher-page-info"
                >
                  {t('admin.common.pageInfo', 'Trang {{current}} / {{total}}', {
                    current: page + 1,
                    total: totalPages,
                  })}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.pageButton,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                    page >= totalPages - 1 && styles.pageButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.next', 'Trang sau ›')}
                  testID="admin-voucher-next-page-btn"
                >
                  <Text style={[styles.pageButtonText, { color: theme.text }]}>
                    {t('admin.common.actions.next', 'Trang sau ›')}
                  </Text>
                </Pressable>
              </View>
            ) : undefined
          }
        />
      )}

      {/* Create Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCreateModal}
        testID="admin-voucher-create-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseCreateModal} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {t('admin.vouchers.createModalTitle', 'Create new voucher')}
                </Text>
                <Pressable
                  onPress={handleCloseCreateModal}
                  disabled={createMutation.isPending}
                  style={styles.modalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.close', 'Close')}
                >
                  <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>✕</Text>
                </Pressable>
              </View>

              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {t(
                  'admin.vouchers.createModalSubtitle',
                  'Platform-wide voucher. Customers enter this code at checkout.',
                )}
              </Text>

              {/* Code */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.codeLabel', 'Voucher code (Code) *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.codeFormatInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={t(
                    'admin.vouchers.codePlaceholder',
                    'Ví dụ: SALE2026, FREESHIP...',
                  )}
                  placeholderTextColor={theme.textSecondary}
                  value={createCode}
                  onChangeText={(val) => {
                    setCreateCode(val.toUpperCase());
                    if (createError) setCreateError(null);
                  }}
                  autoCapitalize="characters"
                  maxLength={64}
                  testID="admin-voucher-code-input"
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                  {t(
                    'admin.vouchers.codeHelp',
                    'Tự động chuyển thành chữ hoa. Chỉ gồm chữ cái, số, - và _ (tối đa 64 ký tự).',
                  )}
                </Text>
              </View>

              {/* Discount Percent & Usage Limit */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    {t('admin.vouchers.discountLabel', 'Discount (%) *')}
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="1 - 100"
                    placeholderTextColor={theme.textSecondary}
                    value={createDiscountPercent}
                    onChangeText={(val) => {
                      setCreateDiscountPercent(val);
                      if (createError) setCreateError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    testID="admin-voucher-discount-input"
                  />
                </View>

                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>
                    {t('admin.vouchers.limitLabel', 'Giới hạn lượt dùng *')}
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Tối thiểu 1"
                    placeholderTextColor={theme.textSecondary}
                    value={createUsageLimit}
                    onChangeText={(val) => {
                      setCreateUsageLimit(val);
                      if (createError) setCreateError(null);
                    }}
                    keyboardType="number-pad"
                    testID="admin-voucher-limit-input"
                  />
                </View>
              </View>

              {/* Validity Presets */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.presetsLabel', 'Thời gian hiệu lực nhanh:')}
                </Text>
                <View style={styles.presetsRow}>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(7, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset7Days', '+7 days')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(30, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset30Days', '+30 days')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(90, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset90Days', '+90 days')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Valid From & Valid To inputs */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.validFromLabel', 'Start (validFrom) *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={createValidFrom}
                  onChangeText={setCreateValidFrom}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={theme.textSecondary}
                  testID="admin-voucher-from-input"
                />
                <Text style={[styles.datePreviewText, { color: theme.primary }]}>
                  {t(
                    'admin.vouchers.previewDisplay',
                    `Display: ${formatDateTimeDisplay(createValidFrom)}`,
                    { time: formatDateTimeDisplay(createValidFrom) },
                  )}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.validToLabel', 'End (validTo) *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={createValidTo}
                  onChangeText={setCreateValidTo}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={theme.textSecondary}
                  testID="admin-voucher-to-input"
                />
                <Text style={[styles.datePreviewText, { color: theme.primary }]}>
                  {t(
                    'admin.vouchers.previewDisplay',
                    `Display: ${formatDateTimeDisplay(createValidTo)}`,
                    { time: formatDateTimeDisplay(createValidTo) },
                  )}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.descLabel', 'Voucher description (Optional)')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={t(
                    'admin.vouchers.descPlaceholder',
                    'e.g. 10% off for the big shopping festival...',
                  )}
                  placeholderTextColor={theme.textSecondary}
                  value={createDescription}
                  onChangeText={setCreateDescription}
                  multiline
                  numberOfLines={2}
                  maxLength={1000}
                  testID="admin-voucher-desc-input"
                />
              </View>

              {/* Error */}
              {createError ? (
                <Text
                  style={[styles.inlineErrorText, { color: theme.danger }]}
                  testID="admin-voucher-create-error"
                >
                  {createError}
                </Text>
              ) : null}

              {/* Buttons */}
              <View style={styles.modalButtonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCloseCreateModal}
                  disabled={createMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.cancel', 'Cancel')}
                  testID="admin-voucher-cancel-create-btn"
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>
                    {t('admin.common.actions.cancel', 'Cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSubmitBtn,
                    { backgroundColor: theme.primary },
                    createMutation.isPending && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSubmitCreate}
                  disabled={createMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.vouchers.createBtn', 'Tạo voucher')}
                  testID="admin-voucher-submit-create-btn"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>
                      {t('admin.vouchers.createBtn', 'Tạo voucher')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={editingVoucher !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditModal}
        testID="admin-voucher-edit-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseEditModal} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {t('admin.vouchers.editModalTitle', 'Edit voucher')}
                </Text>
                <Pressable
                  onPress={handleCloseEditModal}
                  disabled={updateMutation.isPending}
                  style={styles.modalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.close', 'Close')}
                >
                  <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>✕</Text>
                </Pressable>
              </View>

              {/* Readonly Code */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.codeReadonlyLabel', 'Voucher code (Fixed)')}
                </Text>
                <View
                  style={[
                    styles.readonlyCodeBox,
                    {
                      backgroundColor: dynamicStyles.codeBadgeBg,
                      borderColor: dynamicStyles.codeBadgeBorder,
                    },
                  ]}
                  testID="admin-voucher-code-readonly"
                >
                  <Text style={[styles.readonlyCodeText, { color: theme.primary }]}>
                    {editingVoucher?.code}
                  </Text>
                </View>
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                  {t(
                    'admin.vouchers.codeReadonlyHelp',
                    'Mã voucher là khóa định danh chính và không thể thay đổi sau khi tạo.',
                  )}
                </Text>
              </View>

              {/* Discount Percent */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.discountLabel', 'Discount (%) *')}
                </Text>
                {editingVoucher && editingVoucher.timesUsed > 0 ? (
                  <View
                    style={[
                      styles.readonlyBox,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={[styles.readonlyBoxText, { color: theme.text }]}>
                      {editingVoucher.discountPercent}%
                    </Text>
                    <Text
                      style={[
                        styles.restrictionNote,
                        { color: isDark ? '#FBBF24' : '#B54708' },
                      ]}
                    >
                      {t(
                        'admin.vouchers.lockedDiscountNote',
                        `⚠️ This code has been used ${editingVoucher.timesUsed} times so the discount percentage cannot be changed according to system rules.`,
                        { used: editingVoucher.timesUsed },
                      )}
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                    value={editDiscountPercent}
                    onChangeText={(val) => {
                      setEditDiscountPercent(val);
                      if (editError) setEditError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    testID="admin-voucher-edit-discount-input"
                  />
                )}
              </View>

              {/* Usage Limit */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.limitLabel', 'Giới hạn lượt dùng *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={editUsageLimit}
                  onChangeText={(val) => {
                    setEditUsageLimit(val);
                    if (editError) setEditError(null);
                  }}
                  keyboardType="number-pad"
                  testID="admin-voucher-edit-limit-input"
                />
                <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                  {t('admin.vouchers.limitUsedHelp', `Already used: ${editingVoucher?.timesUsed ?? 0} uses. The new limit must be ≥ ${editingVoucher?.timesUsed ?? 0}.`, { used: editingVoucher?.timesUsed ?? 0 })}
                </Text>
              </View>

              {/* Validity Presets */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.presetsExtendLabel', 'Extend validity:')}
                </Text>
                <View style={styles.presetsRow}>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(7, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset7Days', '+7 days')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(30, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset30Days', '+30 days')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: dynamicStyles.presetChipBg,
                        borderColor: dynamicStyles.presetChipBorder,
                      },
                    ]}
                    onPress={() => applyDatePreset(90, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={[styles.presetChipText, { color: dynamicStyles.presetChipText }]}>
                      {t('admin.vouchers.preset90Days', '+90 days')}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Valid From & Valid To inputs */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.validFromLabel', 'Start (validFrom) *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={editValidFrom}
                  onChangeText={setEditValidFrom}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={theme.textSecondary}
                  testID="admin-voucher-edit-from-input"
                />
                <Text style={[styles.datePreviewText, { color: theme.primary }]}>
                  {t(
                    'admin.vouchers.previewDisplay',
                    `Display: ${formatDateTimeDisplay(editValidFrom)}`,
                    { time: formatDateTimeDisplay(editValidFrom) },
                  )}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.validToLabel', 'End (validTo) *')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={editValidTo}
                  onChangeText={setEditValidTo}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={theme.textSecondary}
                  testID="admin-voucher-edit-to-input"
                />
                <Text style={[styles.datePreviewText, { color: theme.primary }]}>
                  {t(
                    'admin.vouchers.previewDisplay',
                    `Display: ${formatDateTimeDisplay(editValidTo)}`,
                    { time: formatDateTimeDisplay(editValidTo) },
                  )}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.vouchers.descLabel', 'Voucher description (Optional)')}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  placeholder={t('admin.vouchers.descEditPlaceholder', 'Voucher description...')}
                  placeholderTextColor={theme.textSecondary}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={2}
                  maxLength={1000}
                  testID="admin-voucher-edit-desc-input"
                />
              </View>

              {/* Error */}
              {editError ? (
                <Text
                  style={[styles.inlineErrorText, { color: theme.danger }]}
                  testID="admin-voucher-edit-error"
                >
                  {editError}
                </Text>
              ) : null}

              {/* Buttons */}
              <View style={styles.modalButtonRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalCancelBtn,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                    },
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCloseEditModal}
                  disabled={updateMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.cancel', 'Cancel')}
                  testID="admin-voucher-cancel-edit-btn"
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>
                    {t('admin.common.actions.cancel', 'Cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSubmitBtn,
                    { backgroundColor: theme.primary },
                    updateMutation.isPending && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSubmitEdit}
                  disabled={updateMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('admin.common.actions.save', 'Save changes')}
                  testID="admin-voucher-submit-edit-btn"
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>
                      {t('admin.common.actions.save', 'Save changes')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  topTextGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  topTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  topSubtitle: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  createButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: typography.sm,
    fontWeight: '700',
  },
  listContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  voucherCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  codeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  codeText: {
    fontSize: typography.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusBadgeText: {
    fontSize: typography.xs,
    fontWeight: '700',
  },
  discountRow: {
    marginVertical: 4,
  },
  discountTagText: {
    fontSize: typography.md,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: typography.sm,
    marginVertical: 4,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: typography.xs,
  },
  infoValue: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  expireButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  expiredBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  expiredBadgeText: {
    fontSize: typography.xs,
    fontStyle: 'italic',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  pageInfoText: {
    fontSize: typography.xs,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: typography.sm,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockIcon: {
    fontSize: 54,
    marginBottom: spacing.md,
  },
  unauthorizedTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: typography.md,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCloseButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: typography.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
  },
  codeFormatInput: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  readonlyCodeBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readonlyCodeText: {
    fontSize: typography.md,
    fontWeight: '800',
  },
  readonlyBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readonlyBoxText: {
    fontSize: typography.md,
    fontWeight: '700',
  },
  restrictionNote: {
    fontSize: typography.xs,
    marginTop: 4,
    lineHeight: 16,
  },
  helperText: {
    fontSize: typography.xs,
    marginTop: 4,
    lineHeight: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  datePreviewText: {
    fontSize: typography.xs,
    marginTop: 2,
    fontWeight: '500',
  },
  inlineErrorText: {
    fontSize: typography.xs,
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalCancelBtnText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: typography.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
});
