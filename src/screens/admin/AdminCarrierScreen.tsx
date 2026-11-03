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
import { colors, radii, spacing, typography } from '../../constants/theme';
import {
  useAdminCarriers,
  useCreateAdminCarrier,
  useUpdateAdminCarrier,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { Carrier } from '../../types/adminApi';

type Props = AppNavigatorScreenProps<'AdminCarrier'>;

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const MAX_CARRIER_NAME_LENGTH = 100;

export default function AdminCarrierScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

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
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedMessage}>
            Only system administrators can manage carriers.
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
      setCreateError('Please enter the carrier name.');
      return;
    }
    if (trimmed.length > MAX_CARRIER_NAME_LENGTH) {
      setCreateError(
        `Carrier name must not exceed ${MAX_CARRIER_NAME_LENGTH} characters.`,
      );
      return;
    }

    try {
      await createMutation.mutateAsync({ name: trimmed });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateError(null);
      Alert.alert('Success', `Added carrier "${trimmed}".`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setCreateError(
          'The carrier name already exists in the system. Please choose another name.',
        );
      } else {
        setCreateError(
          rawMsg || apiError.message || 'Could not create the carrier. Please try again.',
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
      setEditError('Please enter the carrier name.');
      return;
    }
    if (trimmed.length > MAX_CARRIER_NAME_LENGTH) {
      setEditError(
        `Carrier name must not exceed ${MAX_CARRIER_NAME_LENGTH} characters.`,
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
      Alert.alert('Success', 'Carrier information updated.');
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setEditError(
          'The carrier name already exists in the system. Please choose another name.',
        );
      } else {
        setEditError(
          rawMsg || apiError.message || 'Could not update the carrier. Please try again.',
        );
      }
    }
  };

  // Quick Toggle Status Handlers
  const handleToggleStatus = (carrier: Carrier) => {
    if (carrier.active) {
      Alert.alert(
        'Confirm suspension',
        `Are you sure you want to suspend the carrier "${carrier.name}"? Sellers will not be able to choose this carrier when creating new shipments.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Suspend',
            style: 'destructive',
            onPress: async () => {
              try {
                await updateMutation.mutateAsync({
                  id: carrier.id,
                  payload: { active: false },
                });
                Alert.alert('Success', `Suspended carrier "${carrier.name}".`);
              } catch (err: unknown) {
                const apiError = toApiError(err);
                Alert.alert(
                  'Error',
                  apiError.message || 'Could not suspend the carrier. Please try again.',
                );
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Confirm activation',
        `Reactivate carrier "${carrier.name}" for the whole platform? Sellers will be able to choose this carrier when shipping.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Activate',
            onPress: async () => {
              try {
                await updateMutation.mutateAsync({
                  id: carrier.id,
                  payload: { active: true },
                });
                Alert.alert('Success', `Reactivated carrier "${carrier.name}".`);
              } catch (err: unknown) {
                const apiError = toApiError(err);
                Alert.alert(
                  'Error',
                  apiError.message || 'Could not activate the carrier. Please try again.',
                );
              }
            },
          },
        ],
      );
    }
  };

  // Render individual carrier card
  const renderItem = ({ item }: { item: Carrier }) => (
    <View style={styles.card} testID={`admin-carrier-card-${item.id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.carrierIconBox}>
          <Text style={styles.carrierIcon}>🚚</Text>
        </View>
        <View style={styles.carrierMainInfo}>
          <Text style={styles.carrierName} testID={`admin-carrier-name-${item.id}`}>
            {item.name}
          </Text>
          <Text style={styles.carrierIdText} numberOfLines={1}>
            ID: {item.id}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.active ? styles.statusBadgeActive : styles.statusBadgeInactive,
          ]}
          testID={`admin-carrier-status-badge-${item.id}`}
        >
          <Text
            style={[
              styles.statusBadgeText,
              item.active ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive,
            ]}
          >
            {item.active ? '🟢 Active' : '⏹️ Suspended'}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.renameButton, pressed && styles.buttonPressed]}
          onPress={() => handleOpenEditModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Rename ${item.name}`}
          testID={`admin-carrier-rename-btn-${item.id}`}
        >
          <Text style={styles.renameButtonText}>✏️ Rename / Edit</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            item.active ? styles.suspendButton : styles.activateButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleToggleStatus(item)}
          accessibilityRole="button"
          accessibilityLabel={item.active ? `Suspend ${item.name}` : `Activate ${item.name}`}
          testID={`admin-carrier-toggle-btn-${item.id}`}
        >
          <Text
            style={[
              styles.toggleButtonText,
              item.active ? styles.suspendButtonText : styles.activateButtonText,
            ]}
          >
            {item.active ? 'Suspend' : 'Activate'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {/* Top Banner / Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarTextContainer}>
          <Text style={styles.screenTitle}>Carriers</Text>
          <Text style={styles.screenSubtitle}>
            Total: {totalCount} • Active: {activeCount} • Suspended: {inactiveCount}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
          onPress={handleOpenCreateModal}
          accessibilityRole="button"
          accessibilityLabel="Add new carrier"
          testID="admin-carrier-create-btn"
        >
          <Text style={styles.createButtonText}>＋ Add carrier</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by carrier name or UUID..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          testID="admin-carrier-search-input"
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsContainer}>
        <Pressable
          style={[styles.filterTab, statusFilter === 'ALL' && styles.filterTabActive]}
          onPress={() => setStatusFilter('ALL')}
          accessibilityRole="button"
          accessibilityLabel="Filter all"
          testID="admin-carrier-filter-all"
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === 'ALL' && styles.filterTabTextActive,
            ]}
          >
            All ({totalCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, statusFilter === 'ACTIVE' && styles.filterTabActive]}
          onPress={() => setStatusFilter('ACTIVE')}
          accessibilityRole="button"
          accessibilityLabel="Filter active"
          testID="admin-carrier-filter-active"
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === 'ACTIVE' && styles.filterTabTextActive,
            ]}
          >
            Active ({activeCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterTab, statusFilter === 'INACTIVE' && styles.filterTabActive]}
          onPress={() => setStatusFilter('INACTIVE')}
          accessibilityRole="button"
          accessibilityLabel="Filter suspended"
          testID="admin-carrier-filter-inactive"
        >
          <Text
            style={[
              styles.filterTabText,
              statusFilter === 'INACTIVE' && styles.filterTabTextActive,
            ]}
          >
            Suspended ({inactiveCount})
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-carrier-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading carriers...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-carrier-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load the list</Text>
          <Text style={styles.errorMessage}>
            {error instanceof Error ? error.message : 'An error occurred while connecting to the server.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            testID="admin-carrier-retry-btn"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : filteredCarriers.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-carrier-empty">
          <Text style={styles.emptyIcon}>🚚</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() || statusFilter !== 'ALL'
              ? 'No carriers found'
              : 'No carriers yet'}
          </Text>
          <Text style={styles.emptyMessage}>
            {searchQuery.trim() || statusFilter !== 'ALL'
              ? 'Please try changing the search keyword or removing the filter.'
              : 'Tap "＋ Add carrier" above to create the first delivery carrier in the system.'}
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
              colors={[colors.primary]}
              tintColor={colors.primary}
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
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add carrier</Text>
              <Pressable
                onPress={handleCloseCreateModal}
                hitSlop={8}
                disabled={createMutation.isPending}
                testID="admin-carrier-create-close-btn"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              The new carrier name will be added to the system and activated by default so sellers can choose it when shipping.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Carrier name *</Text>
              <TextInput
                style={[styles.input, createError ? styles.inputError : null]}
                placeholder="e.g. Fast Delivery, Express Post..."
                placeholderTextColor={colors.textSecondary}
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
                  <Text style={styles.fieldErrorText} testID="admin-carrier-create-error">
                    {createError}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={styles.charCountText}>
                  {createName.length}/{MAX_CARRIER_NAME_LENGTH}
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                onPress={handleCloseCreateModal}
                disabled={createMutation.isPending}
                testID="admin-carrier-create-cancel-btn"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  createMutation.isPending && styles.submitButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitCreate}
                disabled={createMutation.isPending}
                testID="admin-carrier-create-submit-btn"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add new</Text>
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
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit carrier</Text>
              <Pressable
                onPress={handleCloseEditModal}
                hitSlop={8}
                disabled={updateMutation.isPending}
                testID="admin-carrier-edit-close-btn"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalDescription}>
              Rename or change the active status of the delivery carrier. Deletion is not supported because of linked order data.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Carrier name *</Text>
              <TextInput
                style={[styles.input, editError ? styles.inputError : null]}
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
                  <Text style={styles.fieldErrorText} testID="admin-carrier-edit-error">
                    {editError}
                  </Text>
                ) : (
                  <View />
                )}
                <Text style={styles.charCountText}>
                  {editName.length}/{MAX_CARRIER_NAME_LENGTH}
                </Text>
              </View>
            </View>

            {/* Active Toggle in Modal */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>Let sellers choose</Text>
                <Text style={styles.toggleSublabel}>
                  {editActive
                    ? 'Active: sellers can choose this carrier when creating shipments.'
                    : 'Suspended: sellers cannot choose this carrier for new shipments.'}
                </Text>
              </View>
              <Switch
                value={editActive}
                onValueChange={setEditActive}
                disabled={updateMutation.isPending}
                trackColor={{ false: '#D0D5DD', true: colors.primary }}
                thumbColor="#FFFFFF"
                testID="admin-carrier-edit-active-toggle"
              />
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                onPress={handleCloseEditModal}
                disabled={updateMutation.isPending}
                testID="admin-carrier-edit-cancel-btn"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  updateMutation.isPending && styles.submitButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitEdit}
                disabled={updateMutation.isPending}
                testID="admin-carrier-edit-submit-btn"
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Save changes</Text>
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
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  screenTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    backgroundColor: colors.primary,
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
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    backgroundColor: '#F2F4F7',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    fontSize: typography.md,
    color: colors.text,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#F2F4F7',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: '#F4F3FF',
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
    color: colors.text,
  },
  carrierIdText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FADF',
  },
  statusBadgeInactive: {
    backgroundColor: '#F2F4F7',
  },
  statusBadgeText: {
    fontSize: typography.xs,
    fontWeight: '600',
  },
  statusBadgeTextActive: {
    color: '#027A48',
  },
  statusBadgeTextInactive: {
    color: '#475467',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
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
  renameButton: {
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  renameButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  suspendButton: {
    borderColor: '#FECDCA',
    backgroundColor: '#FEF3F2',
  },
  activateButton: {
    borderColor: '#A6F4C5',
    backgroundColor: '#ECFDF3',
  },
  toggleButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  suspendButtonText: {
    color: '#B42318',
  },
  activateButtonText: {
    color: '#027A48',
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  unauthorizedMessage: {
    fontSize: typography.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
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
    color: colors.text,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
    padding: 4,
  },
  modalDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 8,
    fontSize: typography.md,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: colors.danger,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  fieldErrorText: {
    fontSize: typography.xs,
    color: colors.danger,
    flex: 1,
  },
  charCountText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
  },
  toggleSublabel: {
    fontSize: typography.xs,
    color: colors.textSecondary,
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
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitButton: {
    backgroundColor: colors.primary,
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
