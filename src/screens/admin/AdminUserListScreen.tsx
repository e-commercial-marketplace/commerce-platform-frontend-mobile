/**
 * Admin Portal — User Management List Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Only authenticated users with Role.ADMIN can access.
 * 2. Real Backend Data: GET /api/v1/admin/users
 * 3. Server-side text search (email / name) with debounce.
 * 4. Role filtering: All (undefined), Customer (CUSTOMER), Seller (SELLER), Admin (ADMIN).
 * 5. Zero-based pagination (Previous / Next) with state persistence.
 * 6. Pull-to-refresh and authoritative refetch.
 * 7. User presentation with Role badge, Account Active badge, and Seller Status badge.
 * 8. Navigation to User Detail and Create User screens.
 * 9. Comprehensive accessibility labels and resilient error handling.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAdminUsers } from '../../hooks/useAdmin';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { AdminUser, AdminUserListParams, SellerStatus } from '../../types/adminApi';
import type { Role } from '../../types/auth';

type Props = AppNavigatorScreenProps<'AdminUserList'>;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type RoleFilterOption = {
  key: string;
  label: string;
  value: Role | undefined;
};

const ROLE_FILTER_OPTIONS: RoleFilterOption[] = [
  { key: 'ALL', label: 'All', value: undefined },
  { key: 'CUSTOMER', label: 'Customer', value: 'CUSTOMER' },
  { key: 'SELLER', label: 'Seller', value: 'SELLER' },
  { key: 'ADMIN', label: 'Admin', value: 'ADMIN' },
];

const ROLE_BADGE_CONFIG: Record<
  Role,
  { label: string; backgroundColor: string; textColor: string }
> = {
  CUSTOMER: {
    label: 'Customer',
    backgroundColor: '#EFF8FF',
    textColor: '#175CD3',
  },
  SELLER: {
    label: 'Seller',
    backgroundColor: '#F9F5FF',
    textColor: '#6941C6',
  },
  ADMIN: {
    label: 'Admin',
    backgroundColor: '#F2F4F7',
    textColor: '#344054',
  },
};

const SELLER_STATUS_CONFIG: Record<
  SellerStatus,
  { label: string; backgroundColor: string; textColor: string }
> = {
  PENDING: {
    label: 'Pending',
    backgroundColor: '#FEF0C7',
    textColor: '#B54708',
  },
  APPROVED: {
    label: 'Approved',
    backgroundColor: '#ECFDF3',
    textColor: '#027A48',
  },
  SUSPENDED: {
    label: 'Suspended',
    backgroundColor: '#FEF3F2',
    textColor: '#B42318',
  },
  REJECTED: {
    label: 'Rejected',
    backgroundColor: '#F2F4F7',
    textColor: '#475467',
  },
};

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function AdminUserListScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const [page, setPage] = useState(0);
  const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);

  const queryParams: AdminUserListParams = useMemo(
    () => ({
      role: selectedRole,
      search: debouncedSearch.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [selectedRole, debouncedSearch, page],
  );

  const {
    data: userPage,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAdminUsers(queryParams, isAdmin);

  const users = userPage?.content ?? [];
  const totalPages = userPage?.totalPages ?? 0;
  const totalElements = userPage?.totalElements ?? 0;

  const handleRoleChange = (role: Role | undefined) => {
    setSelectedRole(role);
    setPage(0);
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    setPage(0);
  };

  const handleClearSearch = () => {
    setSearchText('');
    setPage(0);
  };

  const handlePrevPage = () => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages - 1) {
      setPage((prev) => prev + 1);
    }
  };

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedMessage}>
            Only system administrators can access User Management.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: AdminUser }) => {
    const roleBadge = ROLE_BADGE_CONFIG[item.role] ?? {
      label: item.role,
      backgroundColor: '#F2F4F7',
      textColor: '#344054',
    };

    const isEnabled = item.enabled;
    const accountBadge = isEnabled
      ? { label: 'Active', backgroundColor: '#ECFDF3', textColor: '#027A48' }
      : { label: 'Disabled', backgroundColor: '#FEF3F2', textColor: '#B42318' };

    const sellerStatusBadge =
      item.role === 'SELLER' && item.sellerStatus
        ? SELLER_STATUS_CONFIG[item.sellerStatus]
        : null;

    return (
      <Pressable
        style={({ pressed }) => [styles.userCard, pressed && styles.cardPressed]}
        onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`User ${item.name}`}
        testID={`user-item-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </View>

        <View style={styles.badgesRow}>
          {/* Role badge */}
          <View
            style={[styles.badge, { backgroundColor: roleBadge.backgroundColor }]}
            testID={`role-badge-${item.id}`}
          >
            <Text style={[styles.badgeText, { color: roleBadge.textColor }]}>
              {roleBadge.label}
            </Text>
          </View>

          {/* Account status badge */}
          <View
            style={[styles.badge, { backgroundColor: accountBadge.backgroundColor }]}
            testID={`status-badge-${item.id}`}
          >
            <Text style={[styles.badgeText, { color: accountBadge.textColor }]}>
              {accountBadge.label}
            </Text>
          </View>

          {/* Seller status badge if seller */}
          {sellerStatusBadge ? (
            <View
              style={[styles.badge, { backgroundColor: sellerStatusBadge.backgroundColor }]}
              testID={`seller-status-badge-${item.id}`}
            >
              <Text style={[styles.badgeText, { color: sellerStatusBadge.textColor }]}>
                {sellerStatusBadge.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            Registered on: {formatDate(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top action bar: count & Create button */}
      <View style={styles.topActionBar}>
        <Text style={styles.totalCountText}>
          {totalElements > 0 ? `Total: ${totalElements} accounts` : 'Account list'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
          onPress={() => navigation.navigate('AdminUserCreate')}
          accessibilityRole="button"
          accessibilityLabel="Add user"
          testID="create-user-button"
        >
          <Text style={styles.createButtonText}>+ Add new</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email…"
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="user-search-input"
        />
        {searchText.length > 0 ? (
          <Pressable
            onPress={handleClearSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            testID="clear-search-button"
          >
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Role Filter Tabs */}
      <View style={styles.filterRow}>
        {ROLE_FILTER_OPTIONS.map((opt) => {
          const isSelected = selectedRole === opt.value;
          return (
            <Pressable
              key={opt.key}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => handleRoleChange(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${opt.label}`}
              testID={`filter-role-${opt.key}`}
            >
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (users.length === 0) return null;

    return (
      <View style={styles.paginationFooter} testID="pagination-footer">
        <Pressable
          style={[styles.pageButton, (page === 0 || isLoading) && styles.pageButtonDisabled]}
          onPress={handlePrevPage}
          disabled={page === 0 || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          testID="prev-page-button"
        >
          <Text
            style={[
              styles.pageButtonText,
              page === 0 && styles.pageButtonTextDisabled,
            ]}
          >
            ‹ Previous
          </Text>
        </Pressable>

        <Text style={styles.pageInfoText}>
          Trang {page + 1} / {totalPages || 1}
        </Text>

        <Pressable
          style={[
            styles.pageButton,
            (page >= totalPages - 1 || isLoading) && styles.pageButtonDisabled,
          ]}
          onPress={handleNextPage}
          disabled={page >= totalPages - 1 || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Trang sau"
          testID="next-page-button"
        >
          <Text
            style={[
              styles.pageButtonText,
              page >= totalPages - 1 && styles.pageButtonTextDisabled,
            ]}
          >
            Sau ›
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading users…</Text>
        </View>
      );
    }

    if (isError) {
      const errorMessage = error ? toApiError(error).message : 'Unknown error';
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.stateIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load the list</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            testID="retry-button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.stateIcon}>👥</Text>
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptySubtitle}>
          {searchText ? 'Try changing the search keyword or the role filter' : 'The system has no users yet'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  totalCountText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
  },
  createButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 42,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  clearIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    padding: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.md,
    color: colors.text,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: {
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  nameContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  userName: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  cardChevron: {
    fontSize: 22,
    color: colors.textSecondary,
    fontWeight: '300',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    paddingTop: spacing.xs,
  },
  dateText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  stateIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.base,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  unauthorizedTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
  },
  backButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.base,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  pageButtonTextDisabled: {
    color: colors.textSecondary,
  },
  pageInfoText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
