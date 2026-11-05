/**
 * Admin Portal — Shipping Carrier Management Screen (Phase 5).
 *
 * Implements:
 * 1. Admin Role Guard: Authenticated users with Role.ADMIN only.
 * 2. Complete Carrier List: Lists all carriers (active & inactive) via GET /api/v1/admin/carriers.
 *    (Unlike seller fulfillment, admin sees the full system carrier catalog).
 * 3. Create Carrier: POST /api/v1/admin/carriers
 *    - Validates 1..100 characters, trimmed.
 *    - Backend defaults `active = true`.
 *    - Rejects duplicate names gracefully (case-insensitive).
 * 4. Update / Rename / Toggle Carrier: PATCH /api/v1/admin/carriers/{id}
 *    - Renaming (1..100 characters, uniqueness checked).
 *    - Status toggling (active: true/false).
 * 5. NO DELETION: Backend explicitly does not provide DELETE /admin/carriers/{id}
 *    because shipments maintain foreign key reference with ON DELETE RESTRICT.
 *    Carriers are deactivated via active=false.
 * 6. Cross-feature Cache Sync: Invalidation of both admin carrier list and seller fulfillment
 *    carrier cache (`queryKeys.sellerFulfillment.carriers.all`).
 * 7. Responsive UI States: Loading, Error with Retry, Empty, Search/Filter, Pull-to-refresh.
 * 8. Personalization: Complete dark mode support eliminating light-only #FFFFFF surfaces; bilingual i18n.
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
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  useAdminCarriers,
  useCreateAdminCarrier,
  useUpdateAdminCarrier,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { Carrier } from '../../types/adminApi';
import { getCarrierStatusBadgeConfig } from '../../utils/adminPresentation';

type Props = AppNavigatorScreenProps<'AdminCarrier'>;

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const MAX_CARRIER_NAME_LENGTH = 100;

export default function AdminCarrierScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  // Carrier data hook
  const {
    data: carriers = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAdminCarriers(isAdmin);

  // Admin mutations
  const createMutation = useCreateAdminCarrier();
  const updateMutation = useUpdateAdminCarrier();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Create Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal state
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Filtered carrier list
  const filteredCarriers = useMemo(() => {
    return carriers.filter((carrier) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && !carrier.active) return false;
      if (statusFilter === 'INACTIVE' && carrier.active) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return (
          carrier.name.toLowerCase().includes(query) ||
          carrier.id.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [carriers, statusFilter, searchQuery]);

  // Summary counts
  const totalCount = carriers.length;
  const activeCount = useMemo(() => carriers.filter((c) => c.active).length, [carriers]);
  const inactiveCount = totalCount - activeCount;

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
            {t('admin.carriers.unauthorizedAdminOnly', 'Only system administrators can manage carriers.')}
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

  // Create Handlers
  const handleOpenCreateModal = () => {
    setCreateName('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (createMutation.isPending) return;
    setIsCreateModalOpen(false);
    setCreateName('');
    setCreateError(null);
  };

  const handleSubmitCreate = async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError(
        t('admin.carriers.validation.nameRequired', 'Please enter the carrier name.'),
      );
      return;
    }
    if (trimmed.length > MAX_CARRIER_NAME_LENGTH) {
      setCreateError(
        t('admin.carriers.validation.nameTooLong', `Carrier name must not exceed ${MAX_CARRIER_NAME_LENGTH} characters.`, { max: MAX_CARRIER_NAME_LENGTH }),
      );
      return;
    }

    try {
      await createMutation.mutateAsync({ name: trimmed });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateError(null);
      Alert.alert(
        t('admin.common.success', 'Success'),
        t('admin.carriers.createSuccess', `Added carrier "${trimmed}".`, { name: trimmed }),
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        combinedMsg.includes('trùng') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setCreateError(
          t('admin.carriers.validation.nameExists', 'The carrier name already exists in the system. Please choose another name.'),
        );
      } else {
        setCreateError(
          rawMsg ||
            apiError.message ||
            t('admin.carriers.validation.createFailed', 'Could not create the carrier. Please try again.'),
        );
      }
    }
  };

  // Edit Handlers
  const handleOpenEditModal = (carrier: Carrier) => {
    setEditingCarrier(carrier);
    setEditName(carrier.name);
    setEditActive(carrier.active);
    setEditError(null);
  };

  const handleCloseEditModal = () => {
    if (updateMutation.isPending) return;
    setEditingCarrier(null);
    setEditName('');
    setEditError(null);
  };

  const handleSubmitEdit = async () => {
    if (!editingCarrier) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(
        t('admin.carriers.validation.nameRequired', 'Please enter the carrier name.'),
      );
      return;
    }
    if (trimmed.length > MAX_CARRIER_NAME_LENGTH) {
      setEditError(
        t('admin.carriers.validation.nameTooLong', `Carrier name must not exceed ${MAX_CARRIER_NAME_LENGTH} characters.`, { max: MAX_CARRIER_NAME_LENGTH }),
      );
      return;
    }

    const nameChanged = trimmed !== editingCarrier.name;
    const activeChanged = editActive !== editingCarrier.active;

    if (!nameChanged && !activeChanged) {
      handleCloseEditModal();
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingCarrier.id,
        payload: {
          name: nameChanged ? trimmed : undefined,
          active: activeChanged ? editActive : undefined,
        },
      });
      setEditingCarrier(null);
      setEditName('');
      setEditError(null);
      Alert.alert(
        t('admin.common.success', 'Success'),
        t('admin.carriers.updateSuccess', 'Carrier information updated.'),
      );
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        combinedMsg.includes('trùng') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setEditError(
          t('admin.carriers.validation.nameExists', 'The carrier name already exists in the system. Please choose another name.'),
        );
      } else {
        setEditError(
          rawMsg ||
            apiError.message ||
            t('admin.carriers.validation.updateFailed', 'Could not update the carrier. Please try again.'),
        );
      }
    }
  };

  // Quick Toggle Status Handlers
  const handleToggleStatus = (carrier: Carrier) => {
    if (carrier.active) {
      Alert.alert(
        t('admin.carriers.suspendConfirmTitle', 'Confirm suspension'),
        t('admin.carriers.suspendConfirmMsg', `Are you sure you want to suspend the carrier "${carrier.name}"? Sellers will not be able to choose this carrier when creating new shipments.`, { name: carrier.name }),
        [
          { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('admin.carriers.suspendBtn', 'Suspend'),
            style: 'destructive',
            onPress: async () => {
              try {
                await updateMutation.mutateAsync({
                  id: carrier.id,
                  payload: { active: false },
                });
                Alert.alert(
                  t('admin.common.success', 'Success'),
                  t('admin.carriers.suspendSuccess', `Suspended carrier "${carrier.name}".`, { name: carrier.name }),
                );
              } catch (err: unknown) {
                const apiError = toApiError(err);
                Alert.alert(
                  t('admin.common.error', 'Error'),
                  apiError.message ||
                    t('admin.carriers.validation.suspendFailed', 'Could not suspend the carrier. Please try again.'),
                );
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        t('admin.carriers.activateConfirmTitle', 'Confirm activation'),
        t('admin.carriers.activateConfirmMsg', `Reactivate carrier "${carrier.name}" for the whole platform? Sellers will be able to choose this carrier when shipping.`, { name: carrier.name }),
        [
          { text: t('admin.common.actions.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('admin.carriers.activateBtn', 'Activate'),
            onPress: async () => {
              try {
                await updateMutation.mutateAsync({
                  id: carrier.id,
                  payload: { active: true },
                });
                Alert.alert(
                  t('admin.common.success', 'Success'),
                  t('admin.carriers.activateSuccess', `Reactivated carrier "${carrier.name}".`, { name: carrier.name }),
                );
              } catch (err: unknown) {
                const apiError = toApiError(err);
                Alert.alert(
                  t('admin.common.error', 'Error'),
                  apiError.message ||
                    t('admin.carriers.validation.activateFailed', 'Could not activate the carrier. Please try again.'),
                );
              }
            },
          },
        ],
      );
    }
  };

  const dynamicStyles = useMemo(
    () => ({
      iconBoxBg: isDark ? 'rgba(8, 184, 204, 0.2)' : '#F4F3FF',
      filterTabDefaultBg: isDark ? theme.surface : '#F2F4F7',
      suspendBorder: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FECDCA',
      suspendBg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF3F2',
      suspendText: isDark ? '#F87171' : '#B42318',
      activateBorder: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A6F4C5',
      activateBg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF3',
      activateText: isDark ? '#34D399' : '#027A48',
    }),
    [isDark, theme.surface],
  );

  // Render individual carrier card
  const renderItem = ({ item }: { item: Carrier }) => {
    const statusConfig = getCarrierStatusBadgeConfig(item.active, t, isDark);

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
        testID={`admin-carrier-card-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.carrierIconBox, { backgroundColor: dynamicStyles.iconBoxBg }]}>
            <Text style={styles.carrierIcon}>🚚</Text>
          </View>
          <View style={styles.carrierMainInfo}>
            <Text
              style={[styles.carrierName, { color: theme.text }]}
              testID={`admin-carrier-name-${item.id}`}
            >
              {item.name}
            </Text>
            <Text style={[styles.carrierIdText, { color: theme.textSecondary }]} numberOfLines={1}>
              ID: {item.id}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}
            testID={`admin-carrier-status-badge-${item.id}`}
          >
            <Text style={[styles.statusBadgeText, { color: statusConfig.textColor }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                borderColor: theme.border,
                backgroundColor: isDark ? theme.surfaceSubdued : theme.background,
              },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleOpenEditModal(item)}
            accessibilityRole="button"
            accessibilityLabel={t('admin.carriers.renameBtn', '✏️ Rename / Edit')}
            testID={`admin-carrier-rename-btn-${item.id}`}
          >
            <Text style={[styles.renameButtonText, { color: theme.text }]}>
              {t('admin.carriers.renameBtn', '✏️ Rename / Edit')}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                borderColor: item.active
                  ? dynamicStyles.suspendBorder
                  : dynamicStyles.activateBorder,
                backgroundColor: item.active
                  ? dynamicStyles.suspendBg
                  : dynamicStyles.activateBg,
              },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleToggleStatus(item)}
            accessibilityRole="button"
            accessibilityLabel={
              item.active
                ? t('admin.carriers.suspendBtn', 'Suspend')
                : t('admin.carriers.activateBtn', 'Activate')
            }
            testID={`admin-carrier-toggle-btn-${item.id}`}
          >
            <Text
              style={[
                styles.toggleButtonText,
                {
                  color: item.active
                    ? dynamicStyles.suspendText
                    : dynamicStyles.activateText,
                },
              ]}
            >
              {item.active
                ? t('admin.carriers.suspendBtn', 'Suspend')
                : t('admin.carriers.activateBtn', 'Activate')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['bottom', 'left', 'right']}
    >
      {/* Top Banner / Action Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View style={styles.topBarTextContainer}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            {t('admin.carriers.title', 'Carriers')}
          </Text>
          <Text style={[styles.screenSubtitle, { color: theme.textSecondary }]}>
            {t('admin.carriers.subtitle', `Total: ${totalCount} • Active: ${activeCount} • Suspended: ${inactiveCount}`, { total: totalCount, active: activeCount, inactive: inactiveCount })}
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
          accessibilityLabel={t('admin.carriers.createBtn', '＋ Add carrier')}
          testID="admin-carrier-create-btn"
        >
          <Text style={styles.createButtonText}>
            {t('admin.carriers.createBtn', '＋ Add carrier')}
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.surface,
          },
        ]}
      >
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
          placeholder={t('admin.carriers.searchPlaceholder', 'Search by carrier name or UUID...')}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={t('admin.carriers.searchPlaceholder', 'Search by carrier name or UUID...')}
          testID="admin-carrier-search-input"
        />
      </View>

      {/* Filter Tabs */}
      <View
        style={[
          styles.filterTabsContainer,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={[
            styles.filterTab,
            {
              backgroundColor:
                statusFilter === 'ALL' ? theme.primary : dynamicStyles.filterTabDefaultBg,
            },
          ]}
          onPress={() => setStatusFilter('ALL')}
          accessibilityRole="button"
          accessibilityLabel={t('admin.carriers.filterAll', `All (${totalCount})`, { count: totalCount })}
          testID="admin-carrier-filter-all"
        >
          <Text
            style={[
              styles.filterTabText,
              {
                color: statusFilter === 'ALL' ? '#FFFFFF' : theme.textSecondary,
              },
            ]}
          >
            {t('admin.carriers.filterAll', `All (${totalCount})`, { count: totalCount })}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterTab,
            {
              backgroundColor:
                statusFilter === 'ACTIVE' ? theme.primary : dynamicStyles.filterTabDefaultBg,
            },
          ]}
          onPress={() => setStatusFilter('ACTIVE')}
          accessibilityRole="button"
          accessibilityLabel={t('admin.carriers.filterActive', `Active (${activeCount})`, { count: activeCount })}
          testID="admin-carrier-filter-active"
        >
          <Text
            style={[
              styles.filterTabText,
              {
                color: statusFilter === 'ACTIVE' ? '#FFFFFF' : theme.textSecondary,
              },
            ]}
          >
            {t('admin.carriers.filterActive', `Active (${activeCount})`, { count: activeCount })}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.filterTab,
            {
              backgroundColor:
                statusFilter === 'INACTIVE' ? theme.primary : dynamicStyles.filterTabDefaultBg,
            },
          ]}
          onPress={() => setStatusFilter('INACTIVE')}
          accessibilityRole="button"
          accessibilityLabel={t('admin.carriers.filterInactive', `Suspended (${inactiveCount})`, { count: inactiveCount })}
          testID="admin-carrier-filter-inactive"
        >
          <Text
            style={[
              styles.filterTabText,
              {
                color: statusFilter === 'INACTIVE' ? '#FFFFFF' : theme.textSecondary,
              },
            ]}
          >
            {t('admin.carriers.filterInactive', `Suspended (${inactiveCount})`, { count: inactiveCount })}
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-carrier-loading">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('admin.carriers.loading', 'Loading carriers...')}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-carrier-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('admin.carriers.errorTitle', 'Could not load the list')}
          </Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            {error instanceof Error
              ? error.message
              : t('admin.common.error', 'Could not connect to the server.')}
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
            testID="admin-carrier-retry-btn"
          >
            <Text style={styles.retryButtonText}>
              {t('admin.common.actions.retry', 'Retry')}
            </Text>
          </Pressable>
        </View>
      ) : filteredCarriers.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-carrier-empty">
          <Text style={styles.emptyIcon}>🚚</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {searchQuery.trim() || statusFilter !== 'ALL'
              ? t('admin.carriers.emptyFound', 'No carriers found')
              : t('admin.carriers.emptyNone', 'No carriers yet')}
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
            {searchQuery.trim() || statusFilter !== 'ALL'
              ? t('admin.carriers.emptyFilterHelp', 'Try changing search keywords or removing filters.')
              : t('admin.carriers.emptyCreateHelp', 'Tap "＋ Add carrier" above to create the first carrier for the system.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCarriers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
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
        />
      )}

      {/* Create Carrier Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCreateModal}
        testID="admin-carrier-create-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('admin.carriers.createModalTitle', 'Add carrier')}
              </Text>
              <Pressable
                onPress={handleCloseCreateModal}
                hitSlop={8}
                disabled={createMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.close', 'Close')}
                testID="admin-carrier-create-close-btn"
              >
                <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              {t('admin.carriers.createModalDesc', 'The new carrier name will be added to the system and activated by default so sellers can choose it when shipping.')}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {t('admin.carriers.nameLabel', 'Carrier name *')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: createError ? theme.danger : theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder={t('admin.carriers.namePlaceholder', 'e.g. Fast Delivery, Postal Express...')}
                placeholderTextColor={theme.textSecondary}
                value={createName}
                onChangeText={(text) => {
                  setCreateName(text);
                  if (createError) setCreateError(null);
                }}
                maxLength={MAX_CARRIER_NAME_LENGTH}
                autoFocus
                editable={!createMutation.isPending}
                testID="admin-carrier-name-input"
              />
              <View style={styles.charCountRow}>
                {createError ? (
                  <Text
                    style={[styles.fieldErrorText, { color: theme.danger }]}
                    testID="admin-carrier-create-error"
                  >
                    {createError}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={[styles.charCountText, { color: theme.textSecondary }]}>
                  {createName.length}/{MAX_CARRIER_NAME_LENGTH}
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
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
                testID="admin-carrier-create-cancel-btn"
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                  {t('admin.common.actions.cancel', 'Cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  createMutation.isPending && styles.submitButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitCreate}
                disabled={createMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.create', 'Add new')}
                testID="admin-carrier-create-submit-btn"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {t('admin.common.actions.create', 'Add new')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit / Rename Carrier Modal */}
      <Modal
        visible={!!editingCarrier}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEditModal}
        testID="admin-carrier-edit-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('admin.carriers.editModalTitle', 'Edit carrier')}
              </Text>
              <Pressable
                onPress={handleCloseEditModal}
                hitSlop={8}
                disabled={updateMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.close', 'Close')}
                testID="admin-carrier-edit-close-btn"
              >
                <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              {t(
                'admin.carriers.editModalDesc',
                'Đổi tên hoặc thay đổi trạng thái hoạt động của đơn vị giao hàng. Không hỗ trợ xóa do dữ liệu đơn hàng liên kết.',
              )}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                {t('admin.carriers.nameLabel', 'Carrier name *')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    borderColor: editError ? theme.danger : theme.border,
                    color: theme.text,
                  },
                ]}
                value={editName}
                onChangeText={(text) => {
                  setEditName(text);
                  if (editError) setEditError(null);
                }}
                maxLength={MAX_CARRIER_NAME_LENGTH}
                autoFocus
                editable={!updateMutation.isPending}
                testID="admin-carrier-edit-name-input"
              />
              <View style={styles.charCountRow}>
                {editError ? (
                  <Text
                    style={[styles.fieldErrorText, { color: theme.danger }]}
                    testID="admin-carrier-edit-error"
                  >
                    {editError}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={[styles.charCountText, { color: theme.textSecondary }]}>
                  {editName.length}/{MAX_CARRIER_NAME_LENGTH}
                </Text>
              </View>
            </View>

            {/* Active Toggle in Modal */}
            <View
              style={[
                styles.toggleRow,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>
                  {t('admin.carriers.toggleLabel', 'Cho phép người bán chọn')}
                </Text>
                <Text style={[styles.toggleSublabel, { color: theme.textSecondary }]}>
                  {editActive
                    ? t(
                        'admin.carriers.toggleSublabelActive',
                        'Đang hoạt động: người bán có thể chọn đơn vị này khi tạo đơn hàng.',
                      )
                    : t(
                        'admin.carriers.toggleSublabelInactive',
                        'Đã tạm ngừng: người bán không thể chọn đơn vị này khi giao hàng mới.',
                      )}
                </Text>
              </View>
              <Switch
                value={editActive}
                onValueChange={setEditActive}
                disabled={updateMutation.isPending}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
                accessibilityRole="switch"
                accessibilityLabel={t('admin.carriers.toggleLabel', 'Cho phép người bán chọn')}
                accessibilityState={{ checked: editActive }}
                testID="admin-carrier-edit-active-toggle"
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
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
                testID="admin-carrier-edit-cancel-btn"
              >
                <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                  {t('admin.common.actions.cancel', 'Cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.primary },
                  updateMutation.isPending && styles.submitButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitEdit}
                disabled={updateMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.save', 'Save changes')}
                testID="admin-carrier-edit-submit-btn"
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {t('admin.common.actions.save', 'Save changes')}
                  </Text>
                )}
              </Pressable>
            </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  topBarTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  screenTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  createButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    elevation: 2,
  },
  createButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    fontSize: typography.md,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  filterTabText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carrierIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  carrierIcon: {
    fontSize: 22,
  },
  carrierMainInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  carrierName: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  carrierIdText: {
    fontSize: typography.xs,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusBadgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    marginVertical: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  renameButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  toggleButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  unauthorizedTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.md,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  backButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: typography.md,
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 40,
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
    marginBottom: spacing.md,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
  },
  retryButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyIcon: {
    fontSize: 44,
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
  buttonPressed: {
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  modalDescription: {
    fontSize: typography.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 8,
    fontSize: typography.md,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  fieldErrorText: {
    fontSize: typography.xs,
    flex: 1,
  },
  charCountText: {
    fontSize: typography.xs,
    marginLeft: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.md,
    fontWeight: '600',
  },
  toggleSublabel: {
    fontSize: typography.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
