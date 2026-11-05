import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../components/Button';
import { radii, spacing } from '../constants/theme';
import { useOrders } from '../hooks/useOrders';
import { useAppLanguage } from '../i18n';
import type { AppNavigatorScreenProps } from '../navigation/types';
import { useAppTheme } from '../theme';
import type { OrderSummaryResponse } from '../types/orderApi';
import { formatVND } from '../utils/format';

/** Parses a backend decimal money string for display only. */
function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

function OrderCard({
  item,
  onPress,
}: {
  item: OrderSummaryResponse;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();

  const getStatusColor = (status: OrderSummaryResponse['status']) => {
    if (status === 'COMPLETED' || status === 'DELIVERED') {
      return theme.primary;
    }
    if (status === 'CANCELLED') {
      return theme.danger;
    }
    return theme.textSecondary;
  };

  const localizedStatus = t(`orders.status_${item.status}`, item.status);
  const localizedMethod = t(`orders.paymentMethod_${item.paymentMethod}`, item.paymentMethod);
  const localizedPaymentStatus = t(`orders.paymentStatus_${item.paymentStatus}`, item.paymentStatus);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('orders.orderNumber', `Order #${item.id.slice(0, 8)}`, {
        id: item.id.slice(0, 8),
      })}
    >
      <View style={[styles.cardAccent, { backgroundColor: theme.primary }]} />
      <View style={styles.cardHeader}>
        <Text style={[styles.orderId, { color: theme.text }]} numberOfLines={1}>
          {t('orders.orderNumber', `Order #${item.id.slice(0, 8)}`, { id: item.id.slice(0, 8) })}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {localizedStatus}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.payment', 'Payment')}
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>
          {localizedMethod} • {localizedPaymentStatus}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.created', 'Created')}
        </Text>
        <Text style={[styles.value, { color: theme.text }]}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {t('orders.total', 'Total')}
        </Text>
        <Text style={[styles.total, { color: theme.text }]}>
          {formatVND(parseMoney(item.totalAmount))}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation }: AppNavigatorScreenProps<'MyOrders'>) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useOrders(true);

  const orders = data?.pages.flatMap((page) => page.content) ?? [];
  const isInitialLoading = isLoading && orders.length === 0;

  const renderItem = ({ item }: { item: OrderSummaryResponse }) => (
    <OrderCard
      item={item}
      onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage || !hasNextPage) {
      return null;
    }
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  };

  if (isInitialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="my-orders-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('orders.loadingOrders', 'Loading orders…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="my-orders-screen"
      >
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('orders.couldNotLoadOrders', "Couldn't load orders")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('orders.pleaseTryAgain', 'Please try again.')}
          </Text>
          <Button
            title={t('orders.retry', 'Retry')}
            onPress={() => void refetch()}
            style={styles.retryButton}
            accessibilityLabel={t('orders.retry', 'Retry')}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="my-orders-screen"
      >
        <View style={styles.centerState}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('orders.noOrders', 'No orders yet')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('orders.noOrdersSubtitle', 'Your orders will appear here.')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="my-orders-screen"
    >
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 13,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    marginTop: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
});
