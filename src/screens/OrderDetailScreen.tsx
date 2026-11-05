import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';

import { colors, radii, spacing, typography } from '../constants/theme';
import { useAppTheme } from '../theme';
import { useAppLanguage } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useOpenConversation } from '../hooks/useChat';
import { useSellerShop } from '../hooks/useSellers';
import ShopAvatar from '../components/ShopAvatar';
import { useConfirmReceived, useOrderDetail } from '../hooks/useOrders';
import { useRetryPayment } from '../hooks/usePayment';
import { formatVND } from '../utils/format';
import { markPaymentUrlHandled } from '../utils/paymentDeepLink';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { OrderItemResponse, OrderResponse } from '../types/orderApi';
import { ApiError, toApiError } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import Button from '../components/Button';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import WriteReviewModal from '../components/WriteReviewModal';

/** 24 hours in milliseconds for VNPay expiration rule. */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isPaymentExpired(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return false;
  return Date.now() >= createdTime + TWENTY_FOUR_HOURS_MS;
}

export function isPayNowEligible(order: OrderResponse): boolean {
  if (order.paymentMethod !== 'VNPAY') return false;
  if (order.status !== 'PENDING') return false;
  if (order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'REFUNDED') return false;
  if (isPaymentExpired(order.createdAt)) return false;
  return true;
}

function parseRedirectUrl(url: string): { orderId?: string; status?: 'COMPLETED' | 'FAILED' | 'INVALID' } {
  try {
    const qIndex = url.indexOf('?');
    if (qIndex === -1) {
      return {};
    }
    const queryString = url.slice(qIndex + 1);
    const params = new URLSearchParams(queryString);
    const orderId = params.get('orderId') || undefined;
    const rawStatus = params.get('status');
    let status: 'COMPLETED' | 'FAILED' | 'INVALID' | undefined;
    if (rawStatus === 'COMPLETED' || rawStatus === 'FAILED' || rawStatus === 'INVALID') {
      status = rawStatus;
    }
    return { orderId, status };
  } catch {
    return {};
  }
}

/** Parses a backend decimal money string for display only. */
function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return '-';
  }
  try {
    const date = new Date(iso);
    return date.toLocaleString();
  } catch {
    return iso;
  }
}

function ItemRow({
  item,
  canReview,
  onReview,
}: {
  item: OrderItemResponse;
  canReview?: boolean;
  onReview?: () => void;
}) {
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const unitPrice = parseMoney(item.unitPrice);
  const qty = item.quantity || 0;
  const lineTotal = unitPrice * qty;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
          {item.productName}
        </Text>
        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
          {formatVND(unitPrice)} × {qty}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={[styles.itemTotal, { color: theme.text }]}>{formatVND(lineTotal)}</Text>
        {canReview && item.status !== 'CANCELLED' && onReview != null && (
          <Pressable
            style={({ pressed }) => [
              styles.reviewItemButton,
              { backgroundColor: theme.primary },
              pressed && styles.reviewItemButtonPressed,
            ]}
            onPress={onReview}
            accessibilityRole="button"
            accessibilityLabel={t('orders.writeReviewA11y', 'Write review for {{name}}', { name: item.productName })}
          >
            <Text style={[styles.reviewItemButtonText, { color: theme.onPrimary }]}>
              {t('orders.writeReview', 'Write Review')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}


function OrderSellerGroup({
  sellerId,
  items,
  isCustomer,
  isCompletedOrder,
  onReviewItem,
  onOpenShop,
  onOpenChat,
  isOpeningChat,
  chatError,
  showDivider,
}: {
  sellerId: string;
  items: OrderItemResponse[];
  isCustomer: boolean;
  isCompletedOrder: boolean;
  onReviewItem: (item: OrderItemResponse) => void;
  onOpenShop: (sellerId: string) => void;
  onOpenChat: (sellerId: string, shopName?: string) => void;
  isOpeningChat: boolean;
  chatError: string | null;
  showDivider: boolean;
}) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const isRealSeller = Boolean(sellerId && sellerId !== 'unknown');
  const { data: shop } = useSellerShop(isRealSeller ? sellerId : '');
  const shopName = shop?.name ?? (isRealSeller ? `Shop #${sellerId.slice(0, 8)}` : 'Shop');

  return (
    <View style={[styles.sellerGroup, showDivider && [styles.sellerGroupWithDivider, { borderTopColor: theme.border }]]}>
      {isRealSeller && (
        <View style={styles.sellerHeader}>
          <Pressable
            onPress={() => onOpenShop(sellerId)}
            style={({ pressed }) => [styles.sellerHeaderInfo, pressed && styles.sellerHeaderPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('orders.viewShopName', 'Shop {{name}}', { name: shopName })}
          >
            <ShopAvatar name={shop?.name} size={36} />
            <View style={styles.sellerNameContainer}>
              <Text style={[styles.sellerGroupName, { color: theme.text }]} numberOfLines={1}>
                {shopName}
              </Text>
              <Text style={[styles.sellerSubtitle, { color: theme.textSecondary }]}>{t('orders.viewShop', 'Xem shop')}</Text>
            </View>
            <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
          </Pressable>

          {isCustomer && (
            <Pressable
              testID={`chat-seller-${sellerId}`}
              onPress={() => onOpenChat(sellerId, shop?.name)}
              disabled={isOpeningChat}
              style={({ pressed }) => [
                styles.chatWithShopButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.primary,
                },
                isOpeningChat && styles.chatWithShopButtonDisabled,
                pressed && !isOpeningChat && {
                  backgroundColor: isDark ? 'rgba(13, 148, 136, 0.2)' : '#E6F8FA',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('orders.chatWithShop', 'Message the shop')}
            >
              {isOpeningChat ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Text style={styles.chatWithShopIcon}>💬</Text>
                  <Text style={[styles.chatWithShopText, { color: theme.primary }]}>{t('orders.chatWithShop', 'Message the shop')}</Text>
                </>
              )}
            </Pressable>
          )}

          {chatError != null && <Text style={[styles.chatErrorText, { color: theme.danger }]}>{chatError}</Text>}
        </View>
      )}

      <View style={styles.sellerItemsList}>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            canReview={isCompletedOrder}
            onReview={() => onReviewItem(item)}
          />
        ))}
      </View>
    </View>
  );
}

export default function OrderDetailScreen({ route, navigation }: AppNavigatorScreenProps<'OrderDetail'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { orderId, paymentHint: initialPaymentHint } = route.params;
  const { data: order, isLoading, isError, refetch } = useOrderDetail(orderId);
  const confirmMutation = useConfirmReceived();
  const retryPaymentMutation = useRetryPayment();
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<{ productId: string; productName: string } | null>(null);
  const [paymentHint, setPaymentHint] = useState<
    'COMPLETED' | 'FAILED' | 'INVALID' | 'CANCELLED' | undefined
  >(initialPaymentHint);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isRetryingRef = useRef(false);
  const recheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recheckAttemptedRef = useRef(false);

  const { user, isAuthenticated } = useAuth();
  const openConversationMutation = useOpenConversation();
  const [activeChatSellerId, setActiveChatSellerId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<{ sellerId: string; message: string } | null>(null);
  const isOpeningChatRef = useRef(false);

  const canShowChatAction = isAuthenticated && user?.role === 'CUSTOMER';
  const isOpeningChat = openConversationMutation.isPending;

  const handleOpenChat = async (sellerId: string, shopName?: string) => {
    if (isOpeningChatRef.current || openConversationMutation.isPending) {
      return;
    }

    if (!isAuthenticated || user == null) {
      navigation.navigate('Login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      return;
    }

    if (!sellerId || sellerId === 'unknown') {
      setChatError({
        sellerId: sellerId || '',
        message: t('orders.sellerInfoNotFound', 'Seller information not found.'),
      });
      return;
    }

    isOpeningChatRef.current = true;
    setActiveChatSellerId(sellerId);
    setChatError(null);

    try {
      const conversation = await openConversationMutation.mutateAsync({
        sellerId,
        orderId: order?.id ?? orderId,
      });

      navigation.navigate('ChatRoom', {
        conversationId: conversation.id,
        counterpartName: shopName,
        counterpartRole: 'SELLER',
      });
    } catch (err: unknown) {
      const apiErr = toApiError(err);
      setChatError({
        sellerId,
        message: apiErr.message || t('orders.cannotOpenChat', 'Could not open the conversation. Please try again.'),
      });
    } finally {
      isOpeningChatRef.current = false;
      setActiveChatSellerId(null);
    }
  };

  const sellerGroups = useMemo(() => {
    if (!order?.items) return [];
    const map = new Map<string, OrderItemResponse[]>();
    for (const item of order.items) {
      const sId = item.sellerId || 'unknown';
      const existing = map.get(sId);
      if (existing) {
        existing.push(item);
      } else {
        map.set(sId, [item]);
      }
    }
    const result: { sellerId: string; items: OrderItemResponse[] }[] = [];
    for (const [sellerId, groupedItems] of map.entries()) {
      result.push({ sellerId, items: groupedItems });
    }
    return result;
  }, [order?.items]);

  // Bounded recheck when mounted with COMPLETED hint but backend still reports PENDING
  useEffect(() => {
    if (
      paymentHint === 'COMPLETED' &&
      order &&
      order.paymentMethod === 'VNPAY' &&
      order.paymentStatus === 'PENDING' &&
      !recheckAttemptedRef.current
    ) {
      recheckAttemptedRef.current = true;
      recheckTimerRef.current = setTimeout(() => {
        void refetch();
      }, 2500);
    }
    return () => {
      if (recheckTimerRef.current) {
        clearTimeout(recheckTimerRef.current);
      }
    };
  }, [paymentHint, order?.paymentStatus, order?.paymentMethod, refetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePayNow = async () => {
    if (isRetryingRef.current || isRetrying || !order) {
      return;
    }
    isRetryingRef.current = true;
    setIsRetrying(true);
    setRetryError(null);

    try {
      const response = await retryPaymentMutation.mutateAsync(order.id);

      if (!response.paymentUrl || response.paymentUrl.trim().length === 0) {
        setRetryError(t('orders.vnpay_url_unavailable', 'Payment URL unavailable. Please try again later.'));
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(order.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.lists,
        });
        void refetch();
        return;
      }

      let authResult: WebBrowser.WebBrowserAuthSessionResult;
      try {
        authResult = await WebBrowser.openAuthSessionAsync(
          response.paymentUrl,
          'marketplace://payment-result',
        );
      } catch {
        setPaymentHint('FAILED');
        setRetryError(t('orders.vnpay_browser_failed', 'Failed to open payment browser. Please try again.'));
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.detail(order.id),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.orders.lists,
        });
        void refetch();
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(order.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.lists,
      });

      if (authResult.type === 'success' && authResult.url) {
        markPaymentUrlHandled(authResult.url);
        const parsed = parseRedirectUrl(authResult.url);
        const nextHint = parsed.status || 'COMPLETED';
        setPaymentHint(nextHint);
        const refreshed = await refetch();
        if (nextHint === 'COMPLETED' && refreshed.data?.paymentStatus === 'PENDING') {
          if (recheckTimerRef.current) {
            clearTimeout(recheckTimerRef.current);
          }
          recheckTimerRef.current = setTimeout(() => {
            void refetch();
          }, 2500);
        }
      } else {
        setPaymentHint('CANCELLED');
        void refetch();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'ORDER_NOT_PAYABLE') {
          setRetryError(t('orders.vnpay_order_not_payable', 'This order can no longer be paid.'));
        } else {
          setRetryError(err.message || t('orders.vnpay_retry_failed', 'Payment retry failed. Please try again.'));
        }
      } else if (err instanceof Error) {
        setRetryError(err.message || t('orders.vnpay_retry_failed', 'Payment retry failed. Please try again.'));
      } else {
        setRetryError(t('orders.vnpay_retry_failed', 'Payment retry failed. Please try again.'));
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(order.id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orders.lists,
      });
      void refetch();
    } finally {
      isRetryingRef.current = false;
      setIsRetrying(false);
    }
  };

  const handleConfirm = () => {
    if (!order || confirmMutation.isPending) {
      return;
    }
    Alert.alert(
      t('orders.confirmReceived', 'Confirm received'),
      t('orders.confirmReceivedPrompt', 'Are you sure you have received this order?'),
      [
        { text: t('orders.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('orders.confirm', 'Confirm'),
          onPress: () => {
            setConfirming(true);
            confirmMutation.mutate(orderId, {
              onSettled: () => {
                setConfirming(false);
              },
              onError: (err) => {
                if (err instanceof ApiError) {
                  if (err.status === 404) {
                    Alert.alert(
                      t('orders.confirmNotFoundTitle', 'Not found'),
                      t('orders.confirmNotFoundMsg', 'Order not found or not accessible.'),
                    );
                  } else if (err.status === 400) {
                    Alert.alert(
                      t('orders.confirmBlockedTitle', 'Cannot confirm'),
                      err.message || t('orders.confirmBlockedMsg', 'This order cannot be confirmed.'),
                    );
                    void refetch();
                  } else {
                    Alert.alert(
                      t('orders.confirmErrorTitle', 'Error'),
                      err.message || t('orders.confirmErrorMsg', 'Failed to confirm received.'),
                    );
                  }
                } else {
                  Alert.alert(t('orders.confirmErrorTitle', 'Error'), t('orders.confirmErrorMsg', 'Failed to confirm received.'));
                }
              },
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']} testID="order-detail-screen">
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('orders.loadingOrderDetail', 'Loading order…')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']} testID="order-detail-screen">
        <View style={styles.centerState}>
          <Text style={[styles.errorTitle, { color: theme.text }]}>{t('orders.couldNotLoadOrderDetail', "Couldn't load order")}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('orders.orderNotFoundOrNoAccess', "The order may not exist or you don't have access.")}</Text>
          <Pressable onPress={() => refetch()} style={[styles.retryButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>{t('orders.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const showConfirm = order.status === 'DELIVERED';
  const isPendingMutation = confirmMutation.isPending || confirming;
  const isExpired = isPaymentExpired(order.createdAt);
  const canPayNow = isPayNowEligible(order);

  // Compute VNPay banner only for VNPAY orders
  let vnpayBanner: {
    type: 'success' | 'warning' | 'danger' | 'info';
    title: string;
    description: string;
  } | null = null;

  if (order.paymentMethod === 'VNPAY') {
    if (order.paymentStatus === 'COMPLETED') {
      vnpayBanner = {
        type: 'success',
        title: t('orders.vnpay_success_title', 'Payment successful'),
        description: t('orders.vnpay_success_desc', 'Your payment via VNPay has been confirmed.'),
      };
    } else if (order.paymentStatus === 'REFUNDED') {
      vnpayBanner = {
        type: 'info',
        title: t('orders.vnpay_refunded_title', 'Refunded'),
        description: t('orders.vnpay_refunded_desc', 'This payment has been refunded.'),
      };
    } else if (isExpired) {
      vnpayBanner = {
        type: 'warning',
        title: t('orders.vnpay_expired_title', 'Payment expired'),
        description: t('orders.vnpay_expired_desc', 'The 24-hour payment window has expired. This order can no longer be paid.'),
      };
    } else if (order.paymentStatus === 'FAILED') {
      vnpayBanner = {
        type: 'danger',
        title: t('orders.vnpay_failed_title', 'Payment not completed'),
        description: t('orders.vnpay_failed_desc', 'Payment was not successful. You can retry payment while this order is still payable.'),
      };
    } else if (paymentHint === 'COMPLETED') {
      vnpayBanner = {
        type: 'info',
        title: t('orders.vnpay_checking_title', 'Checking payment status…'),
        description: t('orders.vnpay_checking_desc', 'Payment returned successfully. Checking order status…'),
      };
    } else if (paymentHint === 'CANCELLED') {
      vnpayBanner = {
        type: 'warning',
        title: t('orders.vnpay_cancelled_title', 'Payment cancelled'),
        description: t('orders.vnpay_cancelled_desc', 'Payment was cancelled. You can retry while this order is still payable.'),
      };
    } else if (paymentHint === 'FAILED') {
      vnpayBanner = {
        type: 'danger',
        title: t('orders.vnpay_failed_title', 'Payment not completed'),
        description: t('orders.vnpay_failed_desc', 'VNPay reported that payment was not completed.'),
      };
    } else if (paymentHint === 'INVALID') {
      vnpayBanner = {
        type: 'warning',
        title: t('orders.vnpay_unverified_title', 'Payment unverified'),
        description: t('orders.vnpay_unverified_desc', 'Payment result could not be verified. Checking order status…'),
      };
    } else {
      vnpayBanner = {
        type: 'warning',
        title: t('orders.vnpay_pending_title', 'Payment pending'),
        description: t('orders.vnpay_pending_desc', 'Please complete payment within 24 hours of placing your order.'),
      };
    }
  }

  const bannerThemeStyle = (() => {
    if (!vnpayBanner) return null;
    if (isDark) {
      switch (vnpayBanner.type) {
        case 'success':
          return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', title: '#4ADE80', desc: '#86EFAC' };
        case 'warning':
          return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', title: '#FBBF24', desc: '#FCD34D' };
        case 'danger':
          return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', title: '#F87171', desc: '#FCA5A5' };
        case 'info':
          return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', title: '#60A5FA', desc: '#93C5FD' };
      }
    }
    switch (vnpayBanner.type) {
      case 'success':
        return { bg: '#F0FDF4', border: '#BBF7D0', title: '#166534', desc: '#15803D' };
      case 'warning':
        return { bg: '#FFFBEB', border: '#FDE68A', title: '#92400E', desc: '#B45309' };
      case 'danger':
        return { bg: '#FEF2F2', border: '#FECACA', title: '#991B1B', desc: '#B91C1C' };
      case 'info':
        return { bg: '#F0F9FF', border: '#BAE6FD', title: '#075985', desc: '#0369A1' };
    }
  })();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']} testID="order-detail-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.order', 'Order')}</Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.orderId', 'Order ID')}</Text>
            <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
              {order.id}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.status', 'Status')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{t(`orders.status_${order.status}`, order.status)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.created', 'Created')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{formatDate(order.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.payment', 'Payment')}</Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.method', 'Method')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{t(`orders.paymentMethod_${order.paymentMethod}`, order.paymentMethod)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.status', 'Status')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{t(`orders.paymentStatus_${order.paymentStatus}`, order.paymentStatus)}</Text>
          </View>

          {vnpayBanner != null && bannerThemeStyle != null && (
            <View
              style={[
                styles.paymentBanner,
                {
                  backgroundColor: bannerThemeStyle.bg,
                  borderColor: bannerThemeStyle.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.paymentBannerTitle,
                  { color: bannerThemeStyle.title },
                ]}
              >
                {vnpayBanner.title}
              </Text>
              <Text
                style={[
                  styles.paymentBannerDesc,
                  { color: bannerThemeStyle.desc },
                ]}
              >
                {vnpayBanner.description}
              </Text>
            </View>
          )}

          {canPayNow && (
            <View style={styles.payNowContainer}>
              <Button
                title={t('orders.payNow', 'Pay Now')}
                onPress={() => {
                  void handlePayNow();
                }}
                loading={isRetrying}
                disabled={isRetrying}
                fullWidth
                accessibilityLabel={t('orders.payNow', 'Pay Now')}
              />
            </View>
          )}

          {retryError != null && (
            <Text style={[styles.retryErrorText, { color: theme.danger }]}>{retryError}</Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.deliveryAddress', 'Delivery Address')}</Text>
          <Text style={[styles.address, { color: theme.text }]}>{order.shippingAddress}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.items', 'Items')}</Text>
          {sellerGroups.map((group, index) => (
            <OrderSellerGroup
              key={group.sellerId || `seller-${index}`}
              sellerId={group.sellerId}
              items={group.items}
              isCustomer={canShowChatAction}
              isCompletedOrder={order.status === 'COMPLETED'}
              onReviewItem={(item) =>
                setReviewingItem({
                  productId: item.productId,
                  productName: item.productName,
                })
              }
              onOpenShop={(sId) => navigation.navigate('SellerShop', { sellerId: sId })}
              onOpenChat={handleOpenChat}
              isOpeningChat={isOpeningChat && activeChatSellerId === group.sellerId}
              chatError={chatError?.sellerId === group.sellerId ? chatError.message : null}
              showDivider={index > 0}
            />
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.totals', 'Totals')}</Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.shippingFee', 'Shipping Fee')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{formatVND(parseMoney(order.shippingFee))}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.discount', 'Discount')}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{formatVND(parseMoney(order.discountAmount))}</Text>
          </View>
          {order.voucherCode ? (
            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('orders.voucher', 'Voucher')}</Text>
              <Text style={[styles.value, { color: theme.text }]}>{order.voucherCode}</Text>
            </View>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>{t('orders.total', 'Total')}</Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>{formatVND(parseMoney(order.totalAmount))}</Text>
          </View>
        </View>

        {order.shipments && order.shipments.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.shipmentTracking', 'Shipment Tracking')}</Text>
            {order.shipments.map((shipment, index) => (
              <ShipmentTimeline
                key={shipment.id}
                shipment={shipment}
                index={index}
                orderItems={order.items}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('orders.shipmentTracking', 'Shipment Tracking')}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('orders.shipmentNotAvailable', 'Shipment information is not available yet.')}</Text>
          </View>
        )}

        {showConfirm ? (
          <Pressable
            onPress={handleConfirm}
            disabled={isPendingMutation}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: theme.primary },
              (pressed || isPendingMutation) && styles.buttonPressed,
            ]}
          >
            {isPendingMutation ? (
              <ActivityIndicator color={theme.onPrimary} size="small" />
            ) : (
              <Text style={[styles.confirmButtonText, { color: theme.onPrimary }]}>{t('orders.confirmReceived', 'Confirm Received')}</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      {reviewingItem != null && (
        <WriteReviewModal
          visible={true}
          productId={reviewingItem.productId}
          productName={reviewingItem.productName}
          onClose={() => setReviewingItem(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  address: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  reviewItemButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
  },
  reviewItemButtonPressed: {
    opacity: 0.8,
  },
  reviewItemButtonText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  paymentBanner: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  paymentBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  paymentBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  paymentBannerDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  paymentBannerInfo: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  paymentBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  paymentBannerTitleSuccess: {
    color: '#166534',
  },
  paymentBannerTitleWarning: {
    color: '#92400E',
  },
  paymentBannerTitleDanger: {
    color: '#991B1B',
  },
  paymentBannerTitleInfo: {
    color: '#075985',
  },
  paymentBannerDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  paymentBannerDescSuccess: {
    color: '#15803D',
  },
  paymentBannerDescWarning: {
    color: '#B45309',
  },
  paymentBannerDescDanger: {
    color: '#B91C1C',
  },
  paymentBannerDescInfo: {
    color: '#0369A1',
  },
  payNowContainer: {
    marginTop: spacing.xs,
  },
  retryErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  sellerGroup: {
    gap: spacing.xs,
  },
  sellerGroupWithDivider: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sellerHeader: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  sellerHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sellerHeaderPressed: {
    opacity: 0.7,
  },
  sellerNameContainer: {
    flex: 1,
  },
  sellerGroupName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sellerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  chatWithShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    gap: spacing.xs + 2,
  },
  chatWithShopButtonDisabled: {
    opacity: 0.6,
  },
  chatWithShopButtonPressed: {
    backgroundColor: '#E6F8FA',
  },
  chatWithShopIcon: {
    fontSize: 14,
  },
  chatWithShopText: {
    fontSize: typography.xs + 1,
    fontWeight: '600',
    color: colors.primary,
  },
  chatErrorText: {
    fontSize: typography.xs,
    color: colors.danger,
    textAlign: 'center',
  },
  sellerItemsList: {
    gap: 2,
  },
});
