/**
 * Admin Portal — Landing Hub Screen.
 *
 * Central navigation menu for administrative features:
 * 1. User Management (Quản lý người dùng)
 * 2. Seller Approval & Suspension (Quản lý người bán)
 *
 * Role Guard: Authenticated users with Role.ADMIN only.
 * Blocked for CUSTOMER, SELLER, and guest users.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import type { AppNavigatorScreenProps } from '../../navigation/types';

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
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  // Role Guard
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer} testID="admin-unauthorized-guard">
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.unauthorizedTitle}>Truy cập bị từ chối</Text>
          <Text style={styles.unauthorizedMessage}>
            Chỉ Quản trị viên hệ thống mới có quyền truy cập vào Cổng Quản trị.
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

  const menuItems: MenuItem[] = [
    {
      id: 'users',
      title: 'Quản lý người dùng',
      description: 'Xem danh sách, tìm kiếm, phân quyền và quản lý tài khoản người dùng',
      symbol: '👥',
      testID: 'admin-portal-user-management-btn',
      onPress: () => navigation.navigate('AdminUserList'),
    },
    {
      id: 'sellers',
      title: 'Quản lý người bán',
      description: 'Xét duyệt hồ sơ đăng ký người bán và tạm ngưng hoạt động',
      symbol: '🏪',
      testID: 'admin-portal-seller-management-btn',
      onPress: () => navigation.navigate('AdminSellerApproval'),
    },
    {
      id: 'categories',
      title: 'Quản lý danh mục',
      description: 'Thêm, đổi tên và quản lý danh mục sản phẩm toàn sàn',
      symbol: '📁',
      testID: 'admin-portal-category-management-btn',
      onPress: () => navigation.navigate('AdminCategory'),
    },
    {
      id: 'vouchers',
      title: 'Quản lý mã giảm giá',
      description: 'Tạo mã, thiết lập tỷ lệ giảm giá, thời hạn và quản lý voucher toàn sàn',
      symbol: '🎟️',
      testID: 'admin-portal-voucher-management-btn',
      onPress: () => navigation.navigate('AdminVoucher'),
    },
    {
      id: 'carriers',
      title: 'Quản lý đơn vị vận chuyển',
      description: 'Thêm mới, đổi tên và bật/tắt hoạt động của các đơn vị giao hàng toàn sàn',
      symbol: '🚚',
      testID: 'admin-portal-carrier-management-btn',
      onPress: () => navigation.navigate('AdminCarrier'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>Quản trị hệ thống</Text>
          <Text style={styles.headerSubtitle}>
            Xin chào, {user?.name || 'Quản trị viên'}. Chọn phân hệ quản lý bên dưới:
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
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
  headerBox: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  menuList: {
    gap: spacing.md,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuCardPressed: {
    backgroundColor: '#EDEFF3',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: '#E0F7FA',
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
    color: colors.text,
    marginBottom: spacing.xs,
  },
  menuDescription: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  chevronText: {
    fontSize: 24,
    color: colors.textSecondary,
    fontWeight: '300',
  },
});
