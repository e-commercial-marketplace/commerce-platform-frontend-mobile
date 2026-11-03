/**
 * Admin Portal — Category Management Screen.
 *
 * Implements:
 * 1. Admin Role Guard: Authenticated users with Role.ADMIN only.
 * 2. Flat Category Catalog: Lists all categories via public GET /api/v1/categories.
 *    (Backend categories are strictly flat: { id: UUID, name: String }. No hierarchy,
 *    no parent/child relationships, and no product counts returned by backend).
 * 3. Create Category: POST /api/v1/admin/categories
 *    - Validates 1..120 chars, trimmed.
 *    - Rejects duplicate names gracefully with user-friendly error message.
 * 4. Rename Category: PATCH /api/v1/admin/categories/{id}
 *    - Validates 1..120 chars, trimmed.
 *    - Invalidates categories, products, and seller products caches.
 * 5. Delete Category: DELETE /api/v1/admin/categories/{id}
 *    - Native confirmation prompt.
 *    - Handles backend restriction: categories with products (active or hidden) cannot be deleted.
 *      Presents clear Vietnamese alert and leaves category intact.
 * 6. Responsive UI states: Loading, Error with Retry, Empty, Pull-to-refresh.
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { colors, radii, spacing, typography } from '../../constants/theme';
import {
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useProducts';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import type { CategorySummaryDto } from '../../types/productApi';

type Props = AppNavigatorScreenProps<'AdminCategory'>;

const MAX_CATEGORY_NAME_LENGTH = 120;

export default function AdminCategoryScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // Catalog categories hook
  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useCategories();

  // Admin mutations
  const createMutation = useCreateAdminCategory();
  const updateMutation = useUpdateAdminCategory();
  const deleteMutation = useDeleteAdminCategory();

  // Modal & form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<CategorySummaryDto | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Access denied</Text>
          <Text style={styles.unauthorizedMessage}>
            Only system administrators can manage product categories.
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

  // Handle Create submission
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
      setCreateError('Please enter the category name.');
      return;
    }
    if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
      setCreateError(`Category name must not exceed ${MAX_CATEGORY_NAME_LENGTH} characters.`);
      return;
    }

    try {
      await createMutation.mutateAsync({ name: trimmed });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateError(null);
      Alert.alert('Success', `Added category "${trimmed}".`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setCreateError('The category name already exists in the system. Please choose another name.');
      } else {
        setCreateError(rawMsg || apiError.message || 'Could not create the category. Please try again.');
      }
    }
  };

  // Handle Rename submission
  const handleOpenRenameModal = (category: CategorySummaryDto) => {
    setEditingCategory(category);
    setRenameName(category.name);
    setRenameError(null);
  };

  const handleCloseRenameModal = () => {
    if (updateMutation.isPending) return;
    setEditingCategory(null);
    setRenameName('');
    setRenameError(null);
  };

  const handleSubmitRename = async () => {
    if (!editingCategory) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError('Please enter the category name.');
      return;
    }
    if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
      setRenameError(`Category name must not exceed ${MAX_CATEGORY_NAME_LENGTH} characters.`);
      return;
    }

    // If unchanged, simply close without making unnecessary API call
    if (trimmed === editingCategory.name) {
      handleCloseRenameModal();
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingCategory.id,
        payload: { name: trimmed },
      });
      setEditingCategory(null);
      setRenameName('');
      setRenameError(null);
      Alert.alert('Success', `Renamed category to "${trimmed}".`);
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : '';
      const apiError = toApiError(err);
      const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

      if (
        combinedMsg.includes('already exists') ||
        apiError.code === 'VALIDATION_ERROR'
      ) {
        setRenameError('The category name already exists in the system. Please choose another name.');
      } else {
        setRenameError(rawMsg || apiError.message || 'Could not rename the category. Please try again.');
      }
    }
  };

  // Handle Delete
  const handleDeletePress = (category: CategorySummaryDto) => {
    Alert.alert(
      'Confirm category deletion',
      `Are you sure you want to delete the category "${category.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(category.id);
              Alert.alert('Success', `Deleted category "${category.name}".`);
            } catch (err: unknown) {
              const rawMsg = err instanceof Error ? err.message : '';
              const apiError = toApiError(err);
              const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

              if (
                combinedMsg.includes('still has products') ||
                combinedMsg.includes('product')
              ) {
                Alert.alert(
                  'Cannot delete category',
                  'This category still has linked products (including hidden ones). Please move or delete the products in this category first.',
                );
              } else {
                Alert.alert(
                  'Error',
                  rawMsg || apiError.message || 'Could not delete the category. Please try again later.',
                );
              }
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: CategorySummaryDto }) => (
    <View style={styles.categoryCard} testID={`admin-category-item-${item.id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.categoryIconBox}>
          <Text style={styles.categoryIcon}>📁</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName} testID={`admin-category-name-${item.id}`}>
            {item.name}
          </Text>
          <Text style={styles.categoryIdText} numberOfLines={1}>
            ID: {item.id}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.renameButton, pressed && styles.buttonPressed]}
          onPress={() => handleOpenRenameModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Rename category ${item.name}`}
          testID={`admin-category-rename-btn-${item.id}`}
        >
          <Text style={styles.renameButtonText}>✏️ Rename</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.buttonPressed]}
          onPress={() => handleDeletePress(item)}
          accessibilityRole="button"
          accessibilityLabel={`Delete category ${item.name}`}
          testID={`admin-category-delete-btn-${item.id}`}
        >
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {/* Top Banner & Action */}
      <View style={styles.topContainer}>
        <View style={styles.topTextGroup}>
          <Text style={styles.topTitle}>Product categories</Text>
          <Text style={styles.topSubtitle}>
            {categories.length} categories • Flat category system, no hierarchy
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
          onPress={handleOpenCreateModal}
          accessibilityRole="button"
          accessibilityLabel="Add new category"
          testID="admin-category-create-button"
        >
          <Text style={styles.createButtonText}>＋ Add new</Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-category-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-category-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Could not load categories</Text>
          <Text style={styles.errorMessage}>
            An error occurred while connecting to the server. Please try again.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
            onPress={() => {
              void refetch();
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            testID="admin-category-retry-btn"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-category-empty">
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>No categories yet</Text>
          <Text style={styles.emptyMessage}>
            There are no product categories in the system yet. Tap &quot;Add new&quot; to create the first category.
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          testID="admin-category-list"
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

      {/* Create Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseCreateModal}
        testID="admin-category-create-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseCreateModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add new category</Text>
              <Pressable
                onPress={handleCloseCreateModal}
                disabled={createMutation.isPending}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              The category name is shared across all products in the system.
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Category name *</Text>
                <Text style={styles.charCounter}>
                  {createName.trim().length}/{MAX_CATEGORY_NAME_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, createError ? styles.textInputError : null]}
                placeholder="e.g. Electronics, Home appliances..."
                placeholderTextColor={colors.textSecondary}
                value={createName}
                onChangeText={(text) => {
                  setCreateName(text);
                  if (createError) setCreateError(null);
                }}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                autoFocus
                testID="admin-category-name-input"
              />
              {createError ? (
                <Text style={styles.inlineErrorText} testID="admin-category-create-error">
                  {createError}
                </Text>
              ) : null}
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.buttonPressed]}
                onPress={handleCloseCreateModal}
                disabled={createMutation.isPending}
                testID="admin-category-cancel-create-btn"
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSubmitBtn,
                  createMutation.isPending && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitCreate}
                disabled={createMutation.isPending}
                testID="admin-category-submit-create-btn"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create category</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Rename Modal */}
      <Modal
        visible={editingCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRenameModal}
        testID="admin-category-rename-modal"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseRenameModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Rename category</Text>
              <Pressable
                onPress={handleCloseRenameModal}
                disabled={updateMutation.isPending}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close rename dialog"
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Update the name of category &quot;{editingCategory?.name}&quot;. The new name will be shown on all related products.
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>New category name *</Text>
                <Text style={styles.charCounter}>
                  {renameName.trim().length}/{MAX_CATEGORY_NAME_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, renameError ? styles.textInputError : null]}
                placeholder="Enter a new name..."
                placeholderTextColor={colors.textSecondary}
                value={renameName}
                onChangeText={(text) => {
                  setRenameName(text);
                  if (renameError) setRenameError(null);
                }}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                autoFocus
                testID="admin-category-rename-input"
              />
              {renameError ? (
                <Text style={styles.inlineErrorText} testID="admin-category-rename-error">
                  {renameError}
                </Text>
              ) : null}
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={({ pressed }) => [styles.modalCancelBtn, pressed && styles.buttonPressed]}
                onPress={handleCloseRenameModal}
                disabled={updateMutation.isPending}
                testID="admin-category-cancel-rename-btn"
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSubmitBtn,
                  updateMutation.isPending && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitRename}
                disabled={updateMutation.isPending}
                testID="admin-category-submit-rename-btn"
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Save changes</Text>
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
  categoryCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
    alignItems: 'center',
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
  },
  categoryIdText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  renameButton: {
    borderColor: colors.primary,
    backgroundColor: '#F0F5FF',
  },
  renameButtonText: {
    color: colors.primary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: '#FDA29B',
    backgroundColor: '#FEF3F2',
  },
  deleteButtonText: {
    color: '#B42318',
    fontSize: typography.sm,
    fontWeight: '600',
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
    padding: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  charCounter: {
    fontSize: typography.xs,
    color: colors.textSecondary,
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
  textInputError: {
    borderColor: '#FDA29B',
  },
  inlineErrorText: {
    fontSize: typography.xs,
    color: '#D92D20',
    marginTop: 4,
    fontWeight: '500',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
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
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontSize: typography.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
});
