/**
 * Admin Portal — Seller Approval & Management Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Only authenticated users with Role.ADMIN can access.
 * 2. Real Backend Data: GET /api/v1/admin/users?role=SELLER
 * 3. Server-side text search (email / name) with debounce.
 * 4. Zero-based pagination (Previous / Next) with state persistence.
 * 5. Pull-to-refresh and authoritative refetch.
 * 6. Seller status presentation (PENDING, APPROVED, SUSPENDED, REJECTED).
 * 7. Action flows with native confirmation dialogs:
 *    - Phê duyệt (PATCH /api/v1/admin/sellers/{id}/approve) for PENDING/SUSPENDED/REJECTED.
 *    - Tạm ngưng (PATCH /api/v1/admin/sellers/{id}/suspend) for APPROVED.
 * 8. Comprehensive accessibility labels and resilient error handling.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useAdminSellers, useApproveSeller, useSuspendSeller } from '../../hooks/useAdmin';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { AdminUser, SellerStatus } from '../../types/adminApi';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const SELLER_STATUS_CONFIG: Record<
  SellerStatus,
  { label: string; backgroundColor: string; textColor: string }
> = {
  PENDING: {
    label: 'Chờ duyệt',
    backgroundColor: '#FEF0C7',
    textColor: '#B54708',
  },
  APPROVED: {
    label: 'Đã duyệt',
    backgroundColor: '#D1FADF',
    textColor: '#027A48',
  },
  SUSPENDED: {
    label: 'Tạm ngưng',
    backgroundColor: '#FEE4E2',
    textColor: '#B42318',
  },
  REJECTED: {
    label: 'Từ chối',
    backgroundColor: '#F2F4F7',
    textColor: '#344054',
  },
};

function formatCreatedDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

export default function AdminSellerApprovalScreen({
  navigation,
}: AppNavigatorScreenProps<'AdminSellerApproval'>) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = Boolean(isAuthenticated && user?.role === 'ADMIN');

  // Search & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(0);

  // Active mutation tracking for UI disable & feedback
  const [processingSellerId, setProcessingSellerId] = useState<string | null>(null);

  // Reset page when search term changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const queryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [debouncedSearch, page],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminSellers(
    queryParams,
    isAdmin,
  );

  const approveMutation = useApproveSeller();
  const suspendMutation = useSuspendSeller();

  // Data preservation across background refetches
  const hasLoadedOnceRef = useRef(false);
  if (data) {
    hasLoadedOnceRef.current = true;
  }

  // Handle unauthorized access (Role Guard)
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          {navigation.canGoBack?.() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>Quản lý người bán</Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.errorTitle}>Yêu cầu quyền Quản trị viên</Text>
          <Text style={styles.subtitle}>
            Chỉ tài khoản Quản trị viên (ADMIN) mới có quyền truy cập trang quản lý người bán.
          </Text>
          {navigation.canGoBack?.() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.primaryActionButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại trang trước"
            >
              <Text style={styles.primaryActionButtonText}>Quay lại</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const sellers = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;
  const isInitialLoading = isLoading && !hasLoadedOnceRef.current;

  // Pagination Handlers
  const handlePreviousPage = () => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) {
      setPage((prev) => prev + 1);
    }
  };

  // Action: Approve Seller
  const handleApprovePress = (seller: AdminUser) => {
    if (processingSellerId != null) {
      return;
    }

    Alert.alert(
      'Phê duyệt người bán',
      `Bạn có chắc chắn muốn phê duyệt tài khoản người bán "${seller.name}" (${seller.email})?`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Phê duyệt',
          style: 'default',
          onPress: async () => {
            setProcessingSellerId(seller.id);
            try {
              await approveMutation.mutateAsync(seller.id);
              Alert.alert('Thành công', `Đã phê duyệt người bán "${seller.name}".`);
            } catch (err: unknown) {
              const apiError = toApiError(err);
              Alert.alert('Không thể phê duyệt', apiError.message);
            } finally {
              setProcessingSellerId(null);
            }
          },
        },
      ],
    );
  };

  // Action: Suspend Seller
  const handleSuspendPress = (seller: AdminUser) => {
    if (processingSellerId != null) {
      return;
    }

    Alert.alert(
      'Tạm ngưng người bán',
      `Bạn có chắc chắn muốn tạm ngưng tài khoản người bán "${seller.name}" (${seller.email})? Người bán này sẽ không thể thực hiện các thao tác bán hàng.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Tạm ngưng',
          style: 'destructive',
          onPress: async () => {
            setProcessingSellerId(seller.id);
            try {
              await suspendMutation.mutateAsync(seller.id);
              Alert.alert('Thành công', `Đã tạm ngưng người bán "${seller.name}".`);
            } catch (err: unknown) {
              const apiError = toApiError(err);
              Alert.alert('Không thể tạm ngưng', apiError.message);
            } finally {
              setProcessingSellerId(null);
            }
          },
        },
      ],
    );
  };

  // Render a single Seller Card
  const renderSellerItem = ({ item }: { item: AdminUser }) => {
    const statusConfig = item.sellerStatus
      ? SELLER_STATUS_CONFIG[item.sellerStatus]
      : null;
    const isProcessingThisItem = processingSellerId === item.id;
    const isAnyActionPending = processingSellerId != null;

    return (
      <View style={styles.card} testID={`seller-card-${item.id}`}>
        <View style={styles.cardHeader}>
          <View style={styles.sellerIdentity}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>🏬</Text>
            </View>
            <View style={styles.sellerTitleWrap}>
              <Text style={styles.sellerName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sellerEmail} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          </View>
          {statusConfig ? (
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.backgroundColor },
              ]}
              testID={`seller-status-${item.sellerStatus}`}
            >
              <Text style={[styles.statusBadgeText, { color: statusConfig.textColor }]}>
                {statusConfig.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Số điện thoại:</Text>
            <Text style={styles.detailValue}>{item.phone || 'Chưa cập nhật'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Địa chỉ:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {item.address || 'Chưa cập nhật'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Trạng thái tài khoản:</Text>
            <Text
              style={[
                styles.detailValue,
                { color: item.enabled ? '#027A48' : colors.danger },
              ]}
            >
              {item.enabled ? 'Hoạt động' : 'Đã khoá'}
            </Text>
          </View>
          {item.createdAt ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Ngày đăng ký:</Text>
              <Text style={styles.detailValue}>{formatCreatedDate(item.createdAt)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          {item.sellerStatus !== 'APPROVED' ? (
            <Pressable
              onPress={() => handleApprovePress(item)}
              disabled={isAnyActionPending}
              style={({ pressed }) => [
                styles.actionButton,
                styles.approveButton,
                pressed && styles.buttonPressed,
                isAnyActionPending && styles.actionButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Phê duyệt người bán ${item.name}`}
              testID={`approve-btn-${item.id}`}
            >
              {isProcessingThisItem ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.approveButtonText}>Phê duyệt</Text>
              )}
            </Pressable>
          ) : null}

          {item.sellerStatus === 'APPROVED' ? (
            <Pressable
              onPress={() => handleSuspendPress(item)}
              disabled={isAnyActionPending}
              style={({ pressed }) => [
                styles.actionButton,
                styles.suspendButton,
                pressed && styles.buttonPressed,
                isAnyActionPending && styles.actionButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Tạm ngưng người bán ${item.name}`}
              testID={`suspend-btn-${item.id}`}
            >
              {isProcessingThisItem ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.suspendButtonText}>Tạm ngưng</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  // Render Empty State
  const renderEmptyState = () => {
    if (isInitialLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách người bán…</Text>
        </View>
      );
    }

    if (isError) {
      const apiError = toApiError(error);
      return (
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Không thể tải danh sách người bán</Text>
          <Text style={styles.subtitle}>{apiError.message}</Text>
          <Pressable
            onPress={() => void refetch()}
            style={styles.primaryActionButton}
            accessibilityRole="button"
            accessibilityLabel="Thử lại tải danh sách người bán"
            testID="retry-button"
          >
            <Text style={styles.primaryActionButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <Text style={styles.stateIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Không tìm thấy người bán nào</Text>
        <Text style={styles.subtitle}>
          {debouncedSearch
            ? 'Không có tài khoản người bán nào khớp với từ khoá tìm kiếm.'
            : 'Hiện chưa có tài khoản người bán nào trong hệ thống.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Tìm theo email hoặc tên người bán..."
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Tìm kiếm người bán"
            testID="search-input"
          />
          {searchInput.length > 0 ? (
            <Pressable
              onPress={() => setSearchInput('')}
              style={styles.clearSearchButton}
              accessibilityRole="button"
              accessibilityLabel="Xoá tìm kiếm"
              testID="clear-search-button"
            >
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={sellers}
        keyExtractor={(item) => item.id}
        renderItem={renderSellerItem}
        contentContainerStyle={[
          styles.listContent,
          sellers.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => void refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Pagination Footer */}
      {totalPages > 1 || totalElements > 0 ? (
        <View style={styles.paginationFooter} testID="pagination-footer">
          <Pressable
            onPress={handlePreviousPage}
            disabled={page === 0 || isFetching}
            style={({ pressed }) => [
              styles.pageButton,
              (page === 0 || isFetching) && styles.pageButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Trang trước"
            testID="prev-page-button"
          >
            <Text
              style={[
                styles.pageButtonText,
                (page === 0 || isFetching) && styles.pageButtonTextDisabled,
              ]}
            >
              ← Trước
            </Text>
          </Pressable>

          <View style={styles.pageInfoWrap}>
            <Text style={styles.pageInfoText}>
              Trang {page + 1} / {totalPages || 1}
            </Text>
            <Text style={styles.pageCountText}>{totalElements} người bán</Text>
          </View>

          <Pressable
            onPress={handleNextPage}
            disabled={page >= totalPages - 1 || isFetching}
            style={({ pressed }) => [
              styles.pageButton,
              (page >= totalPages - 1 || isFetching) && styles.pageButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Trang sau"
            testID="next-page-button"
          >
            <Text
              style={[
                styles.pageButtonText,
                (page >= totalPages - 1 || isFetching) && styles.pageButtonTextDisabled,
              ]}
            >
              Sau →
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontSize: 22,
    color: colors.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  clearSearchText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sellerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  sellerTitleWrap: {
    flex: 1,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sellerEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  cardDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    flex: 1.5,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: colors.primary,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  suspendButton: {
    backgroundColor: colors.danger,
  },
  suspendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateIcon: {
    fontSize: 42,
    marginBottom: spacing.xs,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  primaryActionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
  pageInfoWrap: {
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  pageCountText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
