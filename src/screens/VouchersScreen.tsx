/**
 * Tất cả voucher đang dùng được, cuộn tới đâu tải tới đó. Công khai, kể cả Guest.
 * Màn này chỉ xem và sao chép mã; áp dụng voucher nằm ở màn đặt hàng, nơi bắt buộc đăng nhập.
 */

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import VoucherRow from '../components/VoucherRow';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useUsableVouchers } from '../hooks/useVoucher';
import type { AppNavigatorScreenProps } from '../navigation/types';

export default function VouchersScreen({ navigation }: AppNavigatorScreenProps<'Vouchers'>) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUsableVouchers();

  const vouchers = data?.pages.flatMap((page) => page.content) ?? [];

  if (isLoading && vouchers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.centerState]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError && vouchers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.centerState]} edges={['bottom']}>
        <Text style={styles.title}>Couldn't load vouchers</Text>
        <Pressable
          onPress={() => {
            void refetch();
          }}
          style={styles.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => <VoucherRow voucher={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          !isAuthenticated ? (
            <View style={styles.signInCard}>
              <Text style={styles.signInText}>Sign in to use a voucher at checkout</Text>
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={styles.title}>No vouchers right now</Text>
            <Text style={styles.subtitle}>Please check back later.</Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator size="small" color={colors.primary} /> : undefined
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  signInText: {
    flex: 1,
    fontSize: typography.md,
    color: colors.text,
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
