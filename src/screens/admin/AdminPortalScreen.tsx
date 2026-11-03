/**
 * Admin Portal — Landing Hub Screen.
 *
 * Central navigation menu for administrative features:
 * 1. User Management (Quản lý người dùng)
 * 2. Seller Approval & Suspension (Quản lý người bán)
 * 3. Category Management (Quản lý danh mục)
 * 4. Voucher Management (Quản lý mã giảm giá)
 * 5. Carrier Management (Quản lý đơn vị vận chuyển)
 *
 * Role Guard: Authenticated users with Role.ADMIN only.
 * Blocked for CUSTOMER, SELLER, and guest users.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useAppLanguage } from '../../i18n';
import type { AppNavigatorScreenProps } from '../../navigation/types';
import { useAppTheme } from '../../theme';

type Props = AppNavigatorScreenProps<'AdminPortal'>;

interface MenuItem {
  id: string;
  title: string;
  description: string;
  symbol: string;
  testID: string;
  onPress: () => void;
}

export default function AdminPortalScreen({ navigation }: Props) {
  const { user, isAuthenticated } = useAuth();
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>
            {t('admin.portal.unauthorizedTitle', 'Truy cập bị từ chối')}
          </Text>
          <Text style={styles.unauthorizedMessage}>
            {t('admin.portal.unauthorizedMessage', 'Chỉ Quản trị viên hệ thống mới có quyền truy cập vào Cổng Quản trị.')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
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

  const menuItems: MenuItem[] = [
    {
      id: 'users',
      title: t('admin.portal.modules.users.title', 'Quản lý người dùng'),
      description: t('admin.portal.modules.users.description', 'Xem danh sách, tìm kiếm, phân quyền và quản lý tài khoản người dùng'),
      symbol: '👥',
      testID: 'admin-portal-user-management-btn',
      onPress: () => navigation.navigate('AdminUserList'),
    },
    {
      id: 'sellers',
      title: t('admin.portal.modules.sellers.title', 'Quản lý người bán'),
      description: t('admin.portal.modules.sellers.description', 'Xét duyệt hồ sơ đăng ký người bán và tạm ngưng hoạt động'),
      symbol: '🏪',
      testID: 'admin-portal-seller-management-btn',
      onPress: () => navigation.navigate('AdminSellerApproval'),
    },
    {
      id: 'categories',
      title: t('admin.portal.modules.categories.title', 'Quản lý danh mục'),
      description: t('admin.portal.modules.categories.description', 'Thêm, đổi tên và quản lý danh mục sản phẩm toàn sàn'),
      symbol: '📁',
      testID: 'admin-portal-category-management-btn',
      onPress: () => navigation.navigate('AdminCategory'),
    },
    {
      id: 'vouchers',
      title: t('admin.portal.modules.vouchers.title', 'Quản lý mã giảm giá'),
      description: t('admin.portal.modules.vouchers.description', 'Tạo mã, thiết lập tỷ lệ giảm giá, thời hạn và quản lý voucher toàn sàn'),
      symbol: '🎟️',
      testID: 'admin-portal-voucher-management-btn',
      onPress: () => navigation.navigate('AdminVoucher'),
    },
    {
      id: 'carriers',
      title: t('admin.portal.modules.carriers.title', 'Quản lý đơn vị vận chuyển'),
      description: t('admin.portal.modules.carriers.description', 'Thêm mới, đổi tên và bật/tắt hoạt động của các đơn vị giao hàng toàn sàn'),
      symbol: '🚚',
      testID: 'admin-portal-carrier-management-btn',
      onPress: () => navigation.navigate('AdminCarrier'),
    },
  ];

  const adminName = user?.name || t('admin.portal.defaultAdmin', 'Quản trị viên');
  const welcomeText = t('admin.portal.greeting', `Xin chào, ${adminName}. Chọn phân hệ quản lý bên dưới:`, { name: adminName });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>
            {t('admin.portal.title', 'Quản trị hệ thống')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {welcomeText}
          </Text>
        </View>

        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.menuCard, pressed && styles.menuCardPressed]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              testID={item.testID}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>{item.symbol}</Text>
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <Text style={styles.chevronText}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>['theme'], isDark = false) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      padding: spacing.md,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    lockIcon: {
      fontSize: 48,
      marginBottom: spacing.sm,
    },
    unauthorizedTitle: {
      fontSize: typography.xl,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.xs,
    },
    unauthorizedMessage: {
      fontSize: typography.md,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    backButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      backgroundColor: theme.primary,
      borderRadius: radii.sm,
    },
    backButtonText: {
      color: theme.onPrimary,
      fontWeight: '600',
      fontSize: typography.base,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    headerBox: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: typography.xl,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.xs,
    },
    headerSubtitle: {
      fontSize: typography.md,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    menuList: {
      gap: spacing.md,
    },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    menuCardPressed: {
      backgroundColor: theme.surfaceSubdued,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: radii.sm,
      backgroundColor: isDark ? '#1A3636' : '#E0F7FA',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    iconText: {
      fontSize: 24,
    },
    menuTextContainer: {
      flex: 1,
      marginRight: spacing.sm,
    },
    menuTitle: {
      fontSize: typography.lg,
      fontWeight: '600',
      color: theme.text,
      marginBottom: spacing.xs,
    },
    menuDescription: {
      fontSize: typography.sm,
      color: theme.textSecondary,
      lineHeight: 18,
    },
    chevronText: {
      fontSize: 24,
      color: theme.textSecondary,
      fontWeight: '300',
    },
  });
