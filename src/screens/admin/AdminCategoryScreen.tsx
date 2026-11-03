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
 * 7. Personalization: Theme-driven semantic styles & localized bilingual strings.
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
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toApiError } from '../../api/errors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useProducts';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';
import type { CategorySummaryDto } from '../../types/productApi';

type Props = AppNavigatorScreenProps<'AdminCategory'>;

const MAX_CATEGORY_NAME_LENGTH = 120;

export default function AdminCategoryScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

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
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={['bottom', 'left', 'right']}
      >
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={[styles.unauthorizedTitle, { color: theme.text }]}>
            {t('admin.portal.unauthorizedTitle', 'Truy cập bị từ chối')}
          </Text>
          <Text style={[styles.unauthorizedMessage, { color: theme.textSecondary }]}>
            {t(
              'admin.categories.unauthorizedAdminOnly',
              'Chỉ Quản trị viên hệ thống mới có quyền quản lý danh mục sản phẩm.',
            )}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('admin.portal.backButton', 'Quay lại')}
          >
            <Text style={styles.backButtonText}>
              {t('admin.portal.backButton', 'Quay lại')}
            </Text>
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
      setCreateError(t('admin.categories.validation.nameRequired', 'Vui lòng nhập tên danh mục.'));
      return;
    }
    if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
      setCreateError(
        t('admin.categories.validation.nameTooLong', 'Tên danh mục không được vượt quá {{max}} ký tự.', {
          max: MAX_CATEGORY_NAME_LENGTH,
        }),
      );
      return;
    }

    try {
      await createMutation.mutateAsync({ name: trimmed });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateError(null);
      Alert.alert(
        t('admin.common.success', 'Thành công'),
        t('admin.categories.createSuccess', 'Đã thêm danh mục "{{name}}".', { name: trimmed }),
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
          t(
            'admin.categories.validation.nameExists',
            'Tên danh mục đã tồn tại trên hệ thống. Vui lòng chọn tên khác.',
          ),
        );
      } else {
        setCreateError(
          rawMsg ||
            apiError.message ||
            t('admin.categories.validation.createFailed', 'Không thể tạo danh mục. Vui lòng thử lại.'),
        );
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
      setRenameError(t('admin.categories.validation.nameRequired', 'Vui lòng nhập tên danh mục.'));
      return;
    }
    if (trimmed.length > MAX_CATEGORY_NAME_LENGTH) {
      setRenameError(
        t('admin.categories.validation.nameTooLong', 'Tên danh mục không được vượt quá {{max}} ký tự.', {
          max: MAX_CATEGORY_NAME_LENGTH,
        }),
      );
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
      Alert.alert(
        t('admin.common.success', 'Thành công'),
        t('admin.categories.renameSuccess', 'Đã đổi tên danh mục thành "{{name}}".', { name: trimmed }),
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
        setRenameError(
          t(
            'admin.categories.validation.nameExists',
            'Tên danh mục đã tồn tại trên hệ thống. Vui lòng chọn tên khác.',
          ),
        );
      } else {
        setRenameError(
          rawMsg ||
            apiError.message ||
            t('admin.categories.validation.renameFailed', 'Không thể đổi tên danh mục. Vui lòng thử lại.'),
        );
      }
    }
  };

  // Handle Delete
  const handleDeletePress = (category: CategorySummaryDto) => {
    Alert.alert(
      t('admin.categories.deleteConfirmTitle', 'Xác nhận xóa danh mục'),
      t(
        'admin.categories.deleteConfirmMessage',
        'Bạn có chắc chắn muốn xóa danh mục "{{name}}"? Thao tác này không thể hoàn tác.',
        { name: category.name },
      ),
      [
        { text: t('admin.common.actions.cancel', 'Hủy'), style: 'cancel' },
        {
          text: t('admin.common.actions.delete', 'Xóa'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(category.id);
              Alert.alert(
                t('admin.common.success', 'Thành công'),
                t('admin.categories.deleteSuccess', 'Đã xóa danh mục "{{name}}".', {
                  name: category.name,
                }),
              );
            } catch (err: unknown) {
              const rawMsg = err instanceof Error ? err.message : '';
              const apiError = toApiError(err);
              const combinedMsg = `${apiError.message} ${rawMsg}`.toLowerCase();

              if (
                combinedMsg.includes('still has products') ||
                combinedMsg.includes('product') ||
                combinedMsg.includes('sản phẩm')
              ) {
                Alert.alert(
                  t('admin.categories.cannotDeleteTitle', 'Không thể xóa danh mục'),
                  t(
                    'admin.categories.cannotDeleteMessage',
                    'Danh mục này đang có sản phẩm liên kết (kể cả sản phẩm đã ẩn). Vui lòng chuyển hoặc xóa các sản phẩm thuộc danh mục này trước.',
                  ),
                );
              } else {
                Alert.alert(
                  t('admin.common.error', 'Lỗi'),
                  rawMsg ||
                    apiError.message ||
                    t(
                      'admin.categories.validation.deleteFailed',
                      'Không thể xóa danh mục. Vui lòng thử lại sau.',
                    ),
                );
              }
            }
          },
        },
      ],
    );
  };

  const dynamicStyles = useMemo(
    () => ({
      iconBoxBg: isDark ? 'rgba(8, 184, 204, 0.2)' : '#EEF4FF',
      renameBtnBg: isDark ? 'rgba(8, 184, 204, 0.15)' : '#F0F5FF',
      deleteBtnBg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF3F2',
      deleteBtnBorder: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FDA29B',
      deleteBtnText: isDark ? '#FCA5A5' : '#B42318',
    }),
    [isDark],
  );

  const renderItem = ({ item }: { item: CategorySummaryDto }) => (
    <View
      style={[
        styles.categoryCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
      testID={`admin-category-item-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.categoryIconBox, { backgroundColor: dynamicStyles.iconBoxBg }]}>
          <Text style={styles.categoryIcon}>📁</Text>
        </View>
        <View style={styles.categoryInfo}>
          <Text
            style={[styles.categoryName, { color: theme.text }]}
            testID={`admin-category-name-${item.id}`}
          >
            {item.name}
          </Text>
          <Text style={[styles.categoryIdText, { color: theme.textSecondary }]} numberOfLines={1}>
            ID: {item.id}
          </Text>
        </View>
      </View>

      <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            {
              borderColor: theme.primary,
              backgroundColor: dynamicStyles.renameBtnBg,
            },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleOpenRenameModal(item)}
          accessibilityRole="button"
          accessibilityLabel={t('admin.categories.renameBtn', '✏️ Đổi tên')}
          accessibilityHint={t('admin.categories.renameModalSubtitle', 'Cập nhật tên danh mục "{{name}}"', {
            name: item.name,
          })}
          testID={`admin-category-rename-btn-${item.id}`}
        >
          <Text style={[styles.renameButtonText, { color: theme.primary }]}>
            {t('admin.categories.renameBtn', '✏️ Đổi tên')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            {
              borderColor: dynamicStyles.deleteBtnBorder,
              backgroundColor: dynamicStyles.deleteBtnBg,
            },
            pressed && styles.buttonPressed,
          ]}
          onPress={() => handleDeletePress(item)}
          accessibilityRole="button"
          accessibilityLabel={t('admin.categories.deleteBtn', '🗑️ Xóa')}
          accessibilityHint={t(
            'admin.categories.deleteConfirmMessage',
            'Bạn có chắc chắn muốn xóa danh mục "{{name}}"?',
            { name: item.name },
          )}
          testID={`admin-category-delete-btn-${item.id}`}
        >
          <Text style={[styles.deleteButtonText, { color: dynamicStyles.deleteBtnText }]}>
            {t('admin.categories.deleteBtn', '🗑️ Xóa')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['bottom', 'left', 'right']}
    >
      {/* Top Banner & Action */}
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
            {t('admin.categories.title', 'Danh mục sản phẩm')}
          </Text>
          <Text style={[styles.topSubtitle, { color: theme.textSecondary }]}>
            {t(
              'admin.categories.subtitle',
              '{{count}} danh mục • Hệ thống danh mục phẳng, không phân cấp',
              { count: categories.length },
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
          accessibilityLabel={t('admin.categories.createBtn', '＋ Thêm mới')}
          testID="admin-category-create-button"
        >
          <Text style={styles.createButtonText}>
            {t('admin.categories.createBtn', '＋ Thêm mới')}
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer} testID="admin-category-loading">
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('admin.categories.loading', 'Đang tải danh sách danh mục...')}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer} testID="admin-category-error">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.text }]}>
            {t('admin.categories.errorTitle', 'Không thể tải danh mục')}
          </Text>
          <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>
            {t(
              'admin.categories.errorMessage',
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
            accessibilityLabel={t('admin.common.actions.retry', 'Thử lại')}
            testID="admin-category-retry-btn"
          >
            <Text style={styles.retryButtonText}>
              {t('admin.common.actions.retry', 'Thử lại')}
            </Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <View style={styles.centerContainer} testID="admin-category-empty">
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('admin.categories.emptyTitle', 'Chưa có danh mục nào')}
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>
            {t(
              'admin.categories.emptyMessage',
              'Hiện chưa có danh mục sản phẩm nào trong hệ thống. Nhấn "Thêm mới" để tạo danh mục đầu tiên.',
            )}
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
              colors={[theme.primary]}
              tintColor={theme.primary}
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
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseCreateModal} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('admin.categories.createModalTitle', 'Thêm danh mục mới')}
              </Text>
              <Pressable
                onPress={handleCloseCreateModal}
                disabled={createMutation.isPending}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.close', 'Đóng')}
              >
                <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {t(
                'admin.categories.createModalSubtitle',
                'Tên danh mục dùng chung cho toàn bộ sản phẩm trên hệ thống.',
              )}
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.categories.nameLabel', 'Tên danh mục *')}
                </Text>
                <Text style={[styles.charCounter, { color: theme.textSecondary }]}>
                  {createName.trim().length}/{MAX_CATEGORY_NAME_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: createError ? theme.danger : theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder={t(
                  'admin.categories.namePlaceholder',
                  'Ví dụ: Thiết bị điện tử, Đồ gia dụng...',
                )}
                placeholderTextColor={theme.textSecondary}
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
                <Text
                  style={[styles.inlineErrorText, { color: theme.danger }]}
                  testID="admin-category-create-error"
                >
                  {createError}
                </Text>
              ) : null}
            </View>

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
                accessibilityLabel={t('admin.common.actions.cancel', 'Hủy')}
                testID="admin-category-cancel-create-btn"
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>
                  {t('admin.common.actions.cancel', 'Hủy')}
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
                accessibilityLabel={t('admin.categories.createBtn', 'Tạo danh mục')}
                testID="admin-category-submit-create-btn"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {t('admin.categories.createModalTitle', 'Tạo danh mục')}
                  </Text>
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
          style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}
        >
          <Pressable style={styles.modalDismissArea} onPress={handleCloseRenameModal} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {t('admin.categories.renameModalTitle', 'Đổi tên danh mục')}
              </Text>
              <Pressable
                onPress={handleCloseRenameModal}
                disabled={updateMutation.isPending}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.close', 'Đóng')}
              >
                <Text style={[styles.modalCloseButtonText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {t(
                'admin.categories.renameModalSubtitle',
                'Cập nhật tên danh mục "{{name}}". Tên mới sẽ hiển thị trên tất cả sản phẩm liên quan.',
                { name: editingCategory?.name },
              )}
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  {t('admin.categories.renameModalTitle', 'Tên danh mục mới *')}
                </Text>
                <Text style={[styles.charCounter, { color: theme.textSecondary }]}>
                  {renameName.trim().length}/{MAX_CATEGORY_NAME_LENGTH}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: renameError ? theme.danger : theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder={t('admin.categories.renamePlaceholder', 'Nhập tên mới...')}
                placeholderTextColor={theme.textSecondary}
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
                <Text
                  style={[styles.inlineErrorText, { color: theme.danger }]}
                  testID="admin-category-rename-error"
                >
                  {renameError}
                </Text>
              ) : null}
            </View>

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
                onPress={handleCloseRenameModal}
                disabled={updateMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.cancel', 'Hủy')}
                testID="admin-category-cancel-rename-btn"
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.text }]}>
                  {t('admin.common.actions.cancel', 'Hủy')}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSubmitBtn,
                  { backgroundColor: theme.primary },
                  updateMutation.isPending && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleSubmitRename}
                disabled={updateMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('admin.common.actions.save', 'Lưu thay đổi')}
                testID="admin-category-submit-rename-btn"
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {t('admin.common.actions.save', 'Lưu thay đổi')}
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
  categoryCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
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
  },
  categoryIdText: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  renameButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  deleteButtonText: {
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
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
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
  },
  charCounter: {
    fontSize: typography.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
  },
  inlineErrorText: {
    fontSize: typography.xs,
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
  },
  modalCancelBtnText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
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
