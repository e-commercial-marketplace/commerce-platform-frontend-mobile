/**
 * All usable vouchers, loaded as you scroll. Public, including Guests.
 * This screen only views and copies codes; applying a voucher happens at checkout, where sign-in is required.
 * Theme & Language aware.
 */

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import VoucherRow from '../components/VoucherRow';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useUsableVouchers } from '../hooks/useVoucher';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';

export default function VouchersScreen({ navigation }: AppNavigatorScreenProps<'Vouchers'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUsableVouchers();

  const vouchers = data?.pages.flatMap((page) => page.content) ?? [];

  if (isLoading && vouchers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.centerState, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError && vouchers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, styles.centerState, { backgroundColor: theme.background }]} edges={['bottom']}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('catalog.errorLoadingVouchers', "Couldn't load vouchers")}
        </Text>
        <Pressable
          onPress={() => {
            void refetch();
          }}
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry', 'Retry')}
        >
          <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
            {t('common.retry', 'Retry')}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['bottom']}>
      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => <VoucherRow voucher={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          !isAuthenticated ? (
            <View style={[styles.signInCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.signInText, { color: theme.textSecondary }]}>
                {t('catalog.signInToUseVoucher', 'Sign in to use a voucher at checkout')}
              </Text>
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel={t('common.signIn', 'Sign in')}
              >
                <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  {t('common.signIn', 'Sign in')}
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('catalog.noVouchersTitle', 'No vouchers right now')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t('catalog.noVouchersDesc', 'Please check back later.')}
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator size="small" color={theme.primary} /> : undefined
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
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  signInCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  signInText: {
    fontSize: typography.sm,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.md,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    borderRadius: radii.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    fontSize: typography.md,
    fontWeight: '700',
  },
});
