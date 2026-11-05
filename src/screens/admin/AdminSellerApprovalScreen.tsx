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
 * 9. Personalization: Theme-driven semantic styles & localized bilingual strings.
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
import { radii, spacing, typography } from '../../constants/theme';
import { useAdminSellers, useApproveSeller, useSuspendSeller } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { AdminUser, SellerStatus } from '../../types/adminApi';
import { getSellerStatusBadgeConfig } from '../../utils/adminPresentation';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function formatCreatedDate(isoString: string): string {
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
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

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
              accessibilityLabel={t('admin.common.actions.back', 'Go back')}
            >
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
          ) : null}
          <Text style={styles.headerTitle}>
            {t('admin.sellers.title', 'Seller management')}
          </Text>
        </View>
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>🔒</Text>
          <Text style={styles.errorTitle}>
            {t('admin.sellers.unauthorizedTitle', 'Admin permission required')}
          </Text>
          <Text style={styles.subtitle}>
            {t('admin.sellers.unauthorizedMessage', 'Only Admin (ADMIN) accounts can access the seller management page.')}
          </Text>
          {navigation.canGoBack?.() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.primaryActionButton}
              accessibilityRole="button"
              accessibilityLabel={t('admin.common.actions.back', 'Go back to the previous page')}
            >
              <Text style={styles.primaryActionButtonText}>
                {t('admin.common.actions.back', 'Go back')}
              </Text>
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
      t('admin.sellers.approveConfirmTitle', 'Approve seller'),
      t(
        'admin.sellers.approveConfirmMessage',
        `Bạn có chắc chắn muốn phê duyệt tài khoản người bán "${seller.name}" (${seller.email})?`,
        { name: seller.name, email: seller.email },
      ),
      [
        { text: t('admin.common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.sellers.approve', 'Approve'),
          style: 'default',
          onPress: async () => {
            setProcessingSellerId(seller.id);
            try {
              await approveMutation.mutateAsync(seller.id);
              Alert.alert(
                t('admin.common.success', 'Success'),
                t('admin.sellers.approveSuccessMessage', `Approved seller "${seller.name}".`, { name: seller.name }),
              );
            } catch (err: unknown) {
              const apiError = toApiError(err);
              Alert.alert(
                t('admin.sellers.approveErrorTitle', 'Cannot approve'),
                apiError.message,
              );
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
      t('admin.sellers.suspendConfirmTitle', 'Suspend seller'),
      t(
        'admin.sellers.suspendConfirmMessage',
        `Bạn có chắc chắn muốn tạm ngưng tài khoản người bán "${seller.name}" (${seller.email})? Người bán này sẽ không thể thực hiện các thao tác bán hàng.`,
        { name: seller.name, email: seller.email },
      ),
      [
        { text: t('admin.common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin.sellers.suspend', 'Suspend'),
          style: 'destructive',
          onPress: async () => {
            setProcessingSellerId(seller.id);
            try {
              await suspendMutation.mutateAsync(seller.id);
              Alert.alert(
                t('admin.common.success', 'Success'),
                t('admin.sellers.suspendSuccessMessage', `Suspended seller "${seller.name}".`, { name: seller.name }),
              );
            } catch (err: unknown) {
              const apiError = toApiError(err);
              Alert.alert(
                t('admin.sellers.suspendErrorTitle', 'Cannot suspend'),
                apiError.message,
              );
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
      ? getSellerStatusBadgeConfig(item.sellerStatus, t, isDark)
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
            <Text style={styles.detailLabel}>
              {t('admin.sellers.phone', 'Phone number:')}
            </Text>
            <Text style={styles.detailValue}>
              {item.phone || t('admin.sellers.notUpdated', 'Not updated')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t('admin.sellers.address', 'Address:')}
            </Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {item.address || t('admin.sellers.notUpdated', 'Not updated')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {t('admin.sellers.accountStatus', 'Account status:')}
            </Text>
            <Text
              style={[
                styles.detailValue,
                { color: item.enabled ? (isDark ? '#34D399' : '#027A48') : theme.danger },
              ]}
            >
              {item.enabled
                ? t('admin.sellers.active', 'Hoạt động')
                : t('admin.sellers.locked', 'Đã khoá')}
            </Text>
          </View>
          {item.createdAt ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t('admin.sellers.registrationDate', 'Registered on:')}
              </Text>
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
              accessibilityLabel={t('admin.sellers.approveAccessibility', `Approve seller ${item.name}`, { name: item.name })}
              testID={`approve-btn-${item.id}`}
            >
              {isProcessingThisItem ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.approveButtonText}>
                  {t('admin.sellers.approve', 'Approve')}
                </Text>
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
              accessibilityLabel={t('admin.sellers.suspendAccessibility', `Suspend seller ${item.name}`, { name: item.name })}
              testID={`suspend-btn-${item.id}`}
            >
              {isProcessingThisItem ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.suspendButtonText}>
                  {t('admin.sellers.suspend', 'Suspend')}
                </Text>
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
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>
            {t('admin.sellers.loading', 'Loading sellers…')}
          </Text>
        </View>
      );
    }

    if (isError) {
      const apiError = toApiError(error);
      return (
        <View style={styles.centerState}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>
            {t('admin.sellers.loadErrorTitle', 'Could not load the seller list')}
          </Text>
          <Text style={styles.subtitle}>{apiError.message}</Text>
          <Pressable
            onPress={() => void refetch()}
            style={styles.primaryActionButton}
            accessibilityRole="button"
            accessibilityLabel={t('admin.sellers.retryAccessibility', 'Retry loading seller list')}
            testID="retry-button"
          >
            <Text style={styles.primaryActionButtonText}>
              {t('admin.sellers.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <Text style={styles.stateIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>
          {t('admin.sellers.emptyTitle', 'No sellers found')}
        </Text>
        <Text style={styles.subtitle}>
          {debouncedSearch
            ? t(
                'admin.sellers.emptySearchDescription',
                'Không có tài khoản người bán nào khớp với từ khoá tìm kiếm.',
              )
            : t(
                'admin.sellers.emptyDefaultDescription',
                'Hiện chưa có tài khoản người bán nào trong hệ thống.',
              )}
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
            placeholder={t('admin.sellers.searchPlaceholder', 'Search by email or seller name...')}
            placeholderTextColor={theme.textSecondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('admin.sellers.searchAccessibility', 'Search sellers')}
            testID="search-input"
          />
          {searchInput.length > 0 ? (
            <Pressable
              onPress={() => setSearchInput('')}
              style={styles.clearSearchButton}
              accessibilityRole="button"
              accessibilityLabel={t('admin.sellers.clearSearchAccessibility', 'Clear search')}
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
            colors={[theme.primary]}
            tintColor={theme.primary}
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
            accessibilityLabel={t('admin.sellers.prevPage', 'Previous page')}
            testID="prev-page-button"
          >
            <Text
              style={[
                styles.pageButtonText,
                (page === 0 || isFetching) && styles.pageButtonTextDisabled,
              ]}
            >
              {t('admin.sellers.prevPage', '← Previous')}
            </Text>
          </Pressable>

          <View style={styles.pageInfoWrap}>
            <Text style={styles.pageInfoText}>
              {t('admin.sellers.pageInfo', `Trang ${page + 1} / ${totalPages || 1}`, {
                page: page + 1,
                totalPages: totalPages || 1,
              })}
            </Text>
            <Text style={styles.pageCountText}>
              {t('admin.sellers.pageCount', `${totalElements} sellers`, {
                count: totalElements,
              })}
            </Text>
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
            accessibilityLabel={t('admin.sellers.nextPage', 'Trang sau')}
            testID="next-page-button"
          >
            <Text
              style={[
                styles.pageButtonText,
                (page >= totalPages - 1 || isFetching) && styles.pageButtonTextDisabled,
              ]}
            >
              {t('admin.sellers.nextPage', 'Sau →')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme'], _isDark = false) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      paddingRight: spacing.sm,
      paddingVertical: spacing.xs,
    },
    backButtonText: {
      fontSize: 22,
      color: theme.text,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    searchContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      height: 40,
    },
    searchIcon: {
      fontSize: 18,
      color: theme.textSecondary,
      marginRight: spacing.xs,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      paddingVertical: 0,
    },
    clearSearchButton: {
      padding: spacing.xs,
    },
    clearSearchText: {
      fontSize: 14,
      color: theme.textSecondary,
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
      backgroundColor: theme.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.border,
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
      backgroundColor: theme.surfaceSubdued,
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
      color: theme.text,
    },
    sellerEmail: {
      fontSize: 13,
      color: theme.textSecondary,
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
      backgroundColor: theme.border,
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
      color: theme.textSecondary,
      flex: 1,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.text,
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
      backgroundColor: theme.primary,
    },
    approveButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    suspendButton: {
      backgroundColor: theme.danger,
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
      color: theme.textSecondary,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 280,
      lineHeight: 18,
    },
    primaryActionButton: {
      backgroundColor: theme.primary,
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
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    pageButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    pageButtonDisabled: {
      opacity: 0.4,
    },
    pageButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    pageButtonTextDisabled: {
      color: theme.textSecondary,
    },
    pageInfoWrap: {
      alignItems: 'center',
    },
    pageInfoText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    pageCountText: {
      fontSize: 11,
      color: theme.textSecondary,
    },
  });
