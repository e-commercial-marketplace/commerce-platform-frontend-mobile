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
 */

import React, { useState } from 'react';
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
import { colors, radii, spacing, typography } from '../../constants/theme';
import {
  useAdminVouchers,
  useCreateAdminVoucher,
  useExpireAdminVoucher,
  useUpdateAdminVoucher,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { VoucherResponse } from '../../types/voucherApi';

type Props = AppNavigatorScreenProps<'AdminVoucher'>;

const PAGE_SIZE = 20;

export type VoucherDerivedStatus =
  | 'ACTIVE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'USAGE_LIMIT_REACHED';

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

const VOUCHER_STATUS_CONFIG: Record<
  VoucherDerivedStatus,
  { label: string; backgroundColor: string; textColor: string; icon: string }
> = {
  ACTIVE: {
    label: 'Đang hoạt động',
    backgroundColor: '#D1FADF',
    textColor: '#027A48',
    icon: '🟢',
  },
  NOT_YET_VALID: {
    label: 'Chưa bắt đầu',
    backgroundColor: '#EFF8FF',
    textColor: '#175CD3',
    icon: '⏳',
  },
  EXPIRED: {
    label: 'Đã hết hạn',
    backgroundColor: '#F2F4F7',
    textColor: '#344054',
    icon: '⏹️',
  },
  USAGE_LIMIT_REACHED: {
    label: 'Hết lượt dùng',
    backgroundColor: '#FEF0C7',
    textColor: '#B54708',
    icon: '⚠️',
  },
};

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
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Truy cập bị từ chối</Text>
          <Text style={styles.unauthorizedMessage}>
            Chỉ Quản trị viên hệ thống mới có quyền quản lý mã giảm giá toàn sàn.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Text style={styles.backButtonText}>Quay lại</Text>
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
      setCreateError('Vui lòng nhập mã voucher.');
      return;
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmedCode)) {
      setCreateError('Mã voucher chỉ được chứa chữ cái, số, gạch ngang (-) và gạch dưới (_), tối đa 64 ký tự.');
      return;
    }

    const discountNum = parseInt(createDiscountPercent, 10);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 100) {
      setCreateError('Tỷ lệ giảm giá phải là số nguyên từ 1% đến 100%.');
      return;
    }

    const usageLimitNum = parseInt(createUsageLimit, 10);
    if (isNaN(usageLimitNum) || usageLimitNum < 1) {
      setCreateError('Giới hạn lượt dùng phải từ 1 trở lên.');
      return;
    }

    const fromDate = new Date(createValidFrom);
    const toDate = new Date(createValidTo);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setCreateError('Thời gian hiệu lực không hợp lệ.');
      return;
    }
    if (fromDate >= toDate) {
      setCreateError('Thời gian bắt đầu (validFrom) phải trước thời gian kết thúc (validTo).');
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
      Alert.alert('Thành công', `Đã tạo mã giảm giá "${trimmedCode}" thành công.`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combined = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (combined.includes('already exists') || combined.includes('trùng')) {
        setCreateError(`Mã voucher "${trimmedCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      } else {
        setCreateError(rawMsg || apiError.message || 'Không thể tạo voucher. Vui lòng thử lại.');
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
      setEditError('Tỷ lệ giảm giá phải từ 1% đến 100%.');
      return;
    }

    // Backend constraint: if timesUsed > 0, discountPercent cannot change
    if (editingVoucher.timesUsed > 0 && discountNum !== editingVoucher.discountPercent) {
      setEditError('Mã này đã được sử dụng nên không thể thay đổi % giảm giá theo quy định hệ thống.');
      return;
    }

    const usageLimitNum = parseInt(editUsageLimit, 10);
    if (isNaN(usageLimitNum) || usageLimitNum < 1) {
      setEditError('Giới hạn lượt dùng phải từ 1 trở lên.');
      return;
    }
    if (usageLimitNum < editingVoucher.timesUsed) {
      setEditError(`Giới hạn lượt dùng không được nhỏ hơn số lượt đã dùng (${editingVoucher.timesUsed}).`);
      return;
    }

    const fromDate = new Date(editValidFrom);
    const toDate = new Date(editValidTo);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setEditError('Thời gian hiệu lực không hợp lệ.');
      return;
    }
    if (fromDate >= toDate) {
      setEditError('Thời gian bắt đầu (validFrom) phải trước thời gian kết thúc (validTo).');
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
      Alert.alert('Thành công', `Đã cập nhật mã giảm giá "${editingVoucher.code}".`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      setEditError(rawMsg || apiError.message || 'Không thể cập nhật voucher. Vui lòng thử lại.');
    }
  };

  // Handle Expire / Deactivate
  const handleExpirePress = (voucher: VoucherResponse) => {
    Alert.alert(
      'Ngừng phát hành voucher',
      `Bạn có chắc chắn muốn ngừng phát hành voucher "${voucher.code}" ngay lập tức? Voucher sẽ chuyển sang trạng thái hết hạn và khách hàng không thể tiếp tục áp dụng cho đơn hàng mới.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận ngừng',
          style: 'destructive',
          onPress: async () => {
            try {
              await expireMutation.mutateAsync(voucher.code);
              Alert.alert('Thành công', `Đã ngừng phát hành voucher "${voucher.code}".`);
            } catch (err: unknown) {
              const rawMsg = err instanceof Error ? err.message : '';
              const apiError = toApiError(err);
              Alert.alert('Lỗi', rawMsg || apiError.message || 'Không thể ngừng phát hành voucher.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: VoucherResponse }) => {
    const status = getVoucherDerivedStatus(item);
    const statusConfig = VOUCHER_STATUS_CONFIG[status];
    const isExpired = status === 'EXPIRED';

    return (
      <View style={styles.voucherCard} testID={`admin-voucher-card-${item.code}`}>
        {/* Header row: Code + Status */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText} testID={`admin-voucher-code-${item.code}`}>
              {item.code}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}
            testID={`admin-voucher-status-${item.code}`}
          >
            <Text style={[styles.statusBadgeText, { color: statusConfig.textColor }]}>
              {statusConfig.icon} {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Discount Tag */}
        <View style={styles.discountRow}>
          <Text style={styles.discountTagText}>🏷️ Giảm {item.discountPercent}%</Text>
        </View>

        {/* Description */}
        {item.description ? (
          <Text style={styles.descriptionText} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Usage Stats */}
        <View style={styles.infoRow} testID={`admin-voucher-usage-${item.code}`}>
          <Text style={styles.infoLabel}>Lượt sử dụng:</Text>
          <Text style={styles.infoValue}>
            {item.timesUsed} / {item.usageLimit} lượt ({Math.min(100, Math.round((item.timesUsed / item.usageLimit) * 100))}%)
          </Text>
        </View>

        {/* Validity Period */}
        <View style={styles.infoRow} testID={`admin-voucher-validity-${item.code}`}>
          <Text style={styles.infoLabel}>Thời gian hiệu lực:</Text>
          <Text style={styles.infoValue}>
            {formatDateTimeDisplay(item.validFrom)} - {formatDateTimeDisplay(item.validTo)}
          </Text>
        </View>

        {/* Actions row */}
        <View style={styles.cardActionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.editButton, pressed && styles.buttonPressed]}
            onPress={() => handleOpenEditModal(item)}
            accessibilityRole="button"
            accessibilityLabel={`Chỉnh sửa voucher ${item.code}`}
            testID={`admin-voucher-edit-btn-${item.code}`}
          >
            <Text style={styles.editButtonText}>✏️ Chỉnh sửa</Text>
          </Pressable>

          {!isExpired ? (
            <Pressable
              style={({ pressed }) => [styles.actionButton, styles.expireButton, pressed && styles.buttonPressed]}
              onPress={() => handleExpirePress(item)}
              accessibilityRole="button"
              accessibilityLabel={`Ngừng phát hành voucher ${item.code}`}
              testID={`admin-voucher-expire-btn-${item.code}`}
            >
              <Text style={styles.expireButtonText}>⏹️ Ngừng phát hành</Text>
            </Pressable>
          ) : (
            <View style={styles.expiredBadge}>
              <Text style={styles.expiredBadgeText}>Đã kết thúc</Text>
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
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {/* Top Bar */}
      <View style={styles.topContainer}>
        <View style={styles.topTextGroup}>
          <Text style={styles.topTitle}>Mã giảm giá toàn sàn</Text>
          <Text style={styles.topSubtitle}>
            {totalElements} mã giảm giá • Áp dụng cho đơn hàng toàn nền tảng
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
          onPress={handleOpenCreateModal}
          accessibilityRole="button"
          accessibilityLabel="Tạo mã giảm giá mới"
          testID="admin-voucher-create-btn"
        >
          <Text style={styles.createButtonText}>＋ Tạo voucher</Text>
        </Pressable>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-voucher-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách mã giảm giá...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-voucher-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Không thể tải danh sách voucher</Text>
          <Text style={styles.errorMessage}>
            Đã xảy ra lỗi khi kết nối với máy chủ. Vui lòng thử lại.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Thử lại"
            testID="admin-voucher-retry-btn"
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : vouchersList.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-voucher-empty">
          <Text style={styles.emptyIcon}>🎟️</Text>
          <Text style={styles.emptyTitle}>Chưa có mã giảm giá nào</Text>
          <Text style={styles.emptyMessage}>
            Chưa có voucher nào được phát hành. Nhấn &quot;Tạo voucher&quot; để thiết lập mã giảm giá đầu tiên.
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
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow} testID="admin-voucher-pagination">
                <Pressable
                  style={({ pressed }) => [
                    styles.pageButton,
                    page === 0 && styles.pageButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Trang trước"
                  testID="admin-voucher-prev-page-btn"
                >
                  <Text style={styles.pageButtonText}>‹ Trang trước</Text>
                </Pressable>

                <Text style={styles.pageInfoText} testID="admin-voucher-page-info">
                  Trang {page + 1} / {totalPages}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.pageButton,
                    page >= totalPages - 1 && styles.pageButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Trang sau"
                  testID="admin-voucher-next-page-btn"
                >
                  <Text style={styles.pageButtonText}>Trang sau ›</Text>
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
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseCreateModal} />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Tạo mã giảm giá mới</Text>
                <Pressable
                  onPress={handleCloseCreateModal}
                  disabled={createMutation.isPending}
                  style={styles.modalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </Pressable>
              </View>

              <Text style={styles.modalSubtitle}>
                Voucher áp dụng toàn sàn. Khách hàng nhập mã này khi thanh toán đơn hàng.
              </Text>

              {/* Code */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mã giảm giá (Code) *</Text>
                <TextInput
                  style={[styles.textInput, styles.codeFormatInput]}
                  placeholder="Ví dụ: SALE2026, FREESHIP..."
                  placeholderTextColor={colors.textSecondary}
                  value={createCode}
                  onChangeText={(val) => {
                    setCreateCode(val.toUpperCase());
                    if (createError) setCreateError(null);
                  }}
                  autoCapitalize="characters"
                  maxLength={64}
                  testID="admin-voucher-code-input"
                />
                <Text style={styles.helperText}>
                  Tự động chuyển thành chữ hoa. Chỉ gồm chữ cái, số, - và _ (tối đa 64 ký tự).
                </Text>
              </View>

              {/* Discount Percent & Usage Limit */}
              <View style={styles.twoColumnRow}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.inputLabel}>Mức giảm (%) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1 - 100"
                    placeholderTextColor={colors.textSecondary}
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
                  <Text style={styles.inputLabel}>Giới hạn lượt dùng *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tối thiểu 1"
                    placeholderTextColor={colors.textSecondary}
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
                <Text style={styles.inputLabel}>Thời gian hiệu lực nhanh:</Text>
                <View style={styles.presetsRow}>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(7, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={styles.presetChipText}>+7 ngày</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(30, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={styles.presetChipText}>+30 ngày</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(90, setCreateValidFrom, setCreateValidTo)}
                  >
                    <Text style={styles.presetChipText}>+90 ngày</Text>
                  </Pressable>
                </View>
              </View>

              {/* Valid From & Valid To inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bắt đầu (validFrom) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={createValidFrom}
                  onChangeText={setCreateValidFrom}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={colors.textSecondary}
                  testID="admin-voucher-from-input"
                />
                <Text style={styles.datePreviewText}>
                  Hiển thị: {formatDateTimeDisplay(createValidFrom)}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kết thúc (validTo) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={createValidTo}
                  onChangeText={setCreateValidTo}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={colors.textSecondary}
                  testID="admin-voucher-to-input"
                />
                <Text style={styles.datePreviewText}>
                  Hiển thị: {formatDateTimeDisplay(createValidTo)}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mô tả voucher (Tùy chọn)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ví dụ: Giảm 10% mừng đại lễ mua sắm..."
                  placeholderTextColor={colors.textSecondary}
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
                <Text style={styles.inlineErrorText} testID="admin-voucher-create-error">
                  {createError}
                </Text>
              ) : null}

              {/* Buttons */}
              <View style={styles.modalButtonRow}>
                <Pressable
                  style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.buttonPressed]}
                  onPress={handleCloseCreateModal}
                  disabled={createMutation.isPending}
                  testID="admin-voucher-cancel-create-btn"
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSubmitBtn,
                    createMutation.isPending && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSubmitCreate}
                  disabled={createMutation.isPending}
                  testID="admin-voucher-submit-create-btn"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Tạo voucher</Text>
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
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseEditModal} />
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Chỉnh sửa mã giảm giá</Text>
                <Pressable
                  onPress={handleCloseEditModal}
                  disabled={updateMutation.isPending}
                  style={styles.modalCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </Pressable>
              </View>

              {/* Readonly Code */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mã giảm giá (Cố định)</Text>
                <View style={styles.readonlyCodeBox} testID="admin-voucher-code-readonly">
                  <Text style={styles.readonlyCodeText}>{editingVoucher?.code}</Text>
                </View>
                <Text style={styles.helperText}>
                  Mã voucher là khóa định danh chính và không thể thay đổi sau khi tạo.
                </Text>
              </View>

              {/* Discount Percent */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mức giảm (%) *</Text>
                {editingVoucher && editingVoucher.timesUsed > 0 ? (
                  <View style={styles.readonlyBox}>
                    <Text style={styles.readonlyBoxText}>{editingVoucher.discountPercent}%</Text>
                    <Text style={styles.restrictionNote}>
                      ⚠️ Mã này đã được dùng {editingVoucher.timesUsed} lần nên không thể đổi % giảm giá theo quy định hệ thống.
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.textInput}
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
                <Text style={styles.inputLabel}>Giới hạn lượt dùng *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editUsageLimit}
                  onChangeText={(val) => {
                    setEditUsageLimit(val);
                    if (editError) setEditError(null);
                  }}
                  keyboardType="number-pad"
                  testID="admin-voucher-edit-limit-input"
                />
                <Text style={styles.helperText}>
                  Đã sử dụng: {editingVoucher?.timesUsed} lượt. Giới hạn mới phải ≥ {editingVoucher?.timesUsed}.
                </Text>
              </View>

              {/* Validity Presets */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gia hạn thời gian:</Text>
                <View style={styles.presetsRow}>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(7, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={styles.presetChipText}>+7 ngày</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(30, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={styles.presetChipText}>+30 ngày</Text>
                  </Pressable>
                  <Pressable
                    style={styles.presetChip}
                    onPress={() => applyDatePreset(90, setEditValidFrom, setEditValidTo)}
                  >
                    <Text style={styles.presetChipText}>+90 ngày</Text>
                  </Pressable>
                </View>
              </View>

              {/* Valid From & Valid To inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bắt đầu (validFrom) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValidFrom}
                  onChangeText={setEditValidFrom}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={colors.textSecondary}
                  testID="admin-voucher-edit-from-input"
                />
                <Text style={styles.datePreviewText}>
                  Hiển thị: {formatDateTimeDisplay(editValidFrom)}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kết thúc (validTo) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValidTo}
                  onChangeText={setEditValidTo}
                  placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
                  placeholderTextColor={colors.textSecondary}
                  testID="admin-voucher-edit-to-input"
                />
                <Text style={styles.datePreviewText}>
                  Hiển thị: {formatDateTimeDisplay(editValidTo)}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mô tả voucher (Tùy chọn)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Mô tả voucher..."
                  placeholderTextColor={colors.textSecondary}
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
                <Text style={styles.inlineErrorText} testID="admin-voucher-edit-error">
                  {editError}
                </Text>
              ) : null}

              {/* Buttons */}
              <View style={styles.modalButtonRow}>
                <Pressable
                  style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.buttonPressed]}
                  onPress={handleCloseEditModal}
                  disabled={updateMutation.isPending}
                  testID="admin-voucher-cancel-edit-btn"
                >
                  <Text style={styles.modalCancelBtnText}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSubmitBtn,
                    updateMutation.isPending && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleSubmitEdit}
                  disabled={updateMutation.isPending}
                  testID="admin-voucher-submit-edit-btn"
                >
                  {updateMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Lưu thay đổi</Text>
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
    backgroundColor: colors.background,
  },
  topContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTextGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  topTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  topSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    backgroundColor: colors.primary,
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
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: '#F0F5FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#D0E0FF',
  },
  codeText: {
    fontSize: typography.md,
    fontWeight: '800',
    color: colors.primary,
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
    color: '#E04F16',
  },
  descriptionText: {
    fontSize: typography.sm,
    color: colors.text,
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
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  editButton: {
    borderColor: colors.primary,
    backgroundColor: '#F0F5FF',
  },
  editButtonText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  expireButton: {
    borderColor: '#FDA29B',
    backgroundColor: '#FEF3F2',
  },
  expireButtonText: {
    color: '#B42318',
    fontSize: typography.sm,
    fontWeight: '600',
  },
  expiredBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  expiredBadgeText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  pageButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  pageInfoText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
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
    color: colors.text,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
    color: colors.text,
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
    backgroundColor: '#F0F5FF',
    borderWidth: 1,
    borderColor: '#D0E0FF',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readonlyCodeText: {
    fontSize: typography.md,
    fontWeight: '800',
    color: colors.primary,
  },
  readonlyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readonlyBoxText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
  },
  restrictionNote: {
    fontSize: typography.xs,
    color: '#B54708',
    marginTop: 4,
    lineHeight: 16,
  },
  helperText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: '#EFF8FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#B2DDFF',
  },
  presetChipText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: '#175CD3',
  },
  datePreviewText: {
    fontSize: typography.xs,
    color: colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  inlineErrorText: {
    fontSize: typography.xs,
    color: '#D92D20',
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancelBtnText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
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
