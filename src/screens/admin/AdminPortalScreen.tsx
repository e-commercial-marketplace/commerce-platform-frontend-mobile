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
            {t('admin.portal.unauthorizedTitle', 'Access denied')}
          </Text>
          <Text style={styles.unauthorizedMessage}>
            {t('admin.portal.unauthorizedMessage', 'Only system administrators can access the Admin Portal.')}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
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

  const menuItems: MenuItem[] = [
    {
      id: 'users',
      title: t('admin.portal.modules.users.title', 'User management'),
      description: t('admin.portal.modules.users.description', 'View the list, search, assign roles and manage user accounts'),
      symbol: '👥',
      testID: 'admin-portal-user-management-btn',
      onPress: () => navigation.navigate('AdminUserList'),
    },
    {
      id: 'sellers',
      title: t('admin.portal.modules.sellers.title', 'Seller management'),
      description: t('admin.portal.modules.sellers.description', 'Review seller registration applications and suspend activity'),
      symbol: '🏪',
      testID: 'admin-portal-seller-management-btn',
      onPress: () => navigation.navigate('AdminSellerApproval'),
    },
    {
      id: 'categories',
      title: t('admin.portal.modules.categories.title', 'Category management'),
      description: t('admin.portal.modules.categories.description', 'Add, rename and manage product categories across the platform'),
      symbol: '📁',
      testID: 'admin-portal-category-management-btn',
      onPress: () => navigation.navigate('AdminCategory'),
    },
    {
      id: 'vouchers',
      title: t('admin.portal.modules.vouchers.title', 'Voucher management'),
      description: t('admin.portal.modules.vouchers.description', 'Create codes, set discount rates and validity periods and manage platform-wide vouchers'),
      symbol: '🎟️',
      testID: 'admin-portal-voucher-management-btn',
      onPress: () => navigation.navigate('AdminVoucher'),
    },
    {
      id: 'carriers',
      title: t('admin.portal.modules.carriers.title', 'Carrier management'),
      description: t('admin.portal.modules.carriers.description', 'Add, rename and enable/disable delivery carriers across the platform'),
      symbol: '🚚',
      testID: 'admin-portal-carrier-management-btn',
      onPress: () => navigation.navigate('AdminCarrier'),
    },
  ];

  const adminName = user?.name || t('admin.portal.defaultAdmin', 'Admin');
  const welcomeText = t('admin.portal.greeting', `Hello, ${adminName}. Choose a management module below:`, { name: adminName });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBox}>
          <Text style={styles.headerTitle}>
            {t('admin.portal.title', 'System administration')}
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
