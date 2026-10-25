import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../constants/theme';
import { useOrders } from '../hooks/useOrders';
import { formatVND } from '../utils/format';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { OrderSummaryResponse } from '../types/orderApi';

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

function getStatusColor(status: OrderSummaryResponse['status']) {
  if (status === 'COMPLETED' || status === 'DELIVERED') {
    return colors.primary;
  }
  if (status === 'CANCELLED') {
    return colors.danger;
  }
  return colors.textSecondary;
}

function OrderCard({
  item,
  onPress,
}: {
  item: OrderSummaryResponse;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <View style={styles.cardAccent} />
      <View style={styles.cardHeader}>
        <Text style={styles.orderId} numberOfLines={1}>
          Order #{item.id.slice(0, 8)}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>{item.status}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Payment</Text>
        <Text style={styles.value}>
          {item.paymentMethod} • {item.paymentStatus}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Created</Text>
        <Text style={styles.value}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.total}>{formatVND(parseMoney(item.totalAmount))}</Text>
      </View>
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation }: AppNavigatorScreenProps<'MyOrders'>) {
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
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>Loading orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Couldn't load orders</Text>
          <Text style={styles.subtitle}>Please try again.</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.subtitle}>Your orders will appear here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
    backgroundColor: colors.background,
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
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
    color: colors.textSecondary,
  },
  value: {
    fontSize: 13,
    color: colors.text,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  cardAccent: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundColor: colors.primary },
});
