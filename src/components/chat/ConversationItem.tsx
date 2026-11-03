/**
 * Conversation row component for the Human Chat conversation list.
 *
 * Sourced directly from backend ConversationResponse DTO:
 * - Counterpart identity (Shop name for Customer; neutral identifier for Seller)
 * - Last activity timestamp (lastMessageAt, falling back to createdAt)
 * - Optional context pill (productId or orderId)
 *
 * NOTE: Strictly adheres to backend capabilities:
 * - NO fake unread badge (backend does not return unreadCount)
 * - NO fake last message preview (backend does not return lastMessageContent)
 * - NO fake online indicator (backend does not track user presence)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import { useSellerShop } from '../../hooks/useSellers';
import type { ConversationResponse } from '../../types/chatApi';
import { formatChatTimestamp } from '../../utils/format';

export type ConversationItemProps = {
  item: ConversationResponse;
  isCustomer: boolean;
  onPress?: (conversation: ConversationResponse) => void;
};

export const ConversationItem = React.memo(function ConversationItem({
  item,
  isCustomer,
  onPress,
}: ConversationItemProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();

  // If viewing as customer, attempt to resolve the seller's shop name via existing useSellerShop
  const { data: shop, isLoading: shopLoading } = useSellerShop(
    isCustomer ? item.sellerId : '',
  );

  const fallbackShopName = t('chat.fallbackShop', `Shop #${item.sellerId.slice(0, 8)}`, {
    id: item.sellerId.slice(0, 8),
  });

  const displayName = isCustomer
    ? shop?.name ?? (shopLoading ? t('chat.loadingShop', 'Đang tải...') : fallbackShopName)
    : t('chat.fallbackCustomer', `Khách hàng #${item.customerId.slice(0, 8)}`, {
        id: item.customerId.slice(0, 8),
      });

  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || (isCustomer ? 'S' : 'K');
  const timestamp = formatChatTimestamp(item.lastMessageAt || item.createdAt);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
        pressed && [
          styles.containerPressed,
          { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6' },
        ],
      ]}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={t('chat.conversationWith', `Cuộc trò chuyện với ${displayName}`, {
        name: displayName,
      })}
      accessibilityHint={t('chat.viewConversationHint', 'Xem chi tiết cuộc trò chuyện')}
    >
      {/* Avatar Initial Circle */}
      <View
        style={[
          styles.avatar,
          isCustomer
            ? [
                styles.shopAvatar,
                { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EEF2FF' },
              ]
            : [
                styles.customerAvatar,
                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#F0FDF4' },
              ],
        ]}
      >
        <Text style={[styles.avatarText, { color: theme.primary }]}>{avatarInitial}</Text>
      </View>

      {/* Main Info */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {timestamp ? (
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>{timestamp}</Text>
          ) : null}
        </View>

        {/* Optional Context Pills */}
        <View style={styles.contextRow}>
          {item.productId ? (
            <View
              style={[
                styles.contextBadge,
                { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#E0E7FF' },
              ]}
            >
              <Text
                style={[
                  styles.contextBadgeText,
                  { color: isDark ? '#A5B4FC' : '#3730A3' },
                ]}
              >
                {t('chat.contextProduct', 'Sản phẩm')}
              </Text>
            </View>
          ) : null}

          {item.orderId ? (
            <View
              style={[
                styles.contextBadge,
                styles.orderBadge,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
              ]}
            >
              <Text
                style={[
                  styles.contextBadgeText,
                  { color: isDark ? '#FCD34D' : '#3730A3' },
                ]}
                numberOfLines={1}
              >
                {t('chat.contextOrder', `Đơn #${item.orderId.slice(0, 8)}`, {
                  id: item.orderId.slice(0, 8),
                })}
              </Text>
            </View>
          ) : null}

          {!item.productId && !item.orderId ? (
            <Text style={[styles.idleHint, { color: theme.textSecondary }]}>
              {t('chat.directChat', 'Trò chuyện trực tiếp')}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  containerPressed: {
    backgroundColor: '#F3F4F6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shopAvatar: {
    backgroundColor: '#EEF2FF',
  },
  customerAvatar: {
    backgroundColor: '#F0FDF4',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  contextBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderBadge: {
    backgroundColor: '#FEF3C7',
  },
  contextBadgeText: {
    fontSize: 11,
    color: '#3730A3',
    fontWeight: '500',
  },
  idleHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
