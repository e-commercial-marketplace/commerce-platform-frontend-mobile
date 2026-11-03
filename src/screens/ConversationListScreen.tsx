/**
 * Human Customer–Seller Chat Conversation List Screen (Inbox).
 *
 * Sourced directly from backend REST GET /conversations and WebSocket /ws/chat:
 * - Lists conversations for authenticated CUSTOMER and SELLER users.
 * - Real-time sync via useChatWebSocket() triggers instant query updates.
 * - Adheres strictly to backend data contracts:
 *   - Customer resolves shop names via useSellerShop.
 *   - Seller displays neutral customer identifier (Khách hàng #...).
 *   - No fake unread badges or last message previews.
 * - Row tap opens ChatRoom for the selected conversation.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConversationItem } from '../components/chat/ConversationItem';
import { colors } from '../constants/theme';
import { useAppTheme } from '../theme';
import { useAppLanguage } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useConversations } from '../hooks/useChat';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { ConversationResponse } from '../types/chatApi';

export default function ConversationListScreen({
  navigation,
}: AppNavigatorScreenProps<'ConversationList'>) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { user, isAuthenticated } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const isSeller = user?.role === 'SELLER';
  const isAuthorizedRole = isCustomer || isSeller;

  // Real-time WebSocket connection active while on this screen
  useChatWebSocket();

  // Load conversation list from backend
  const {
    data: conversations = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useConversations(isAuthenticated && isAuthorizedRole);

  // Connect conversation row tap to ChatRoom screen
  const handleRowPress = useCallback(
    (conversation: ConversationResponse) => {
      navigation.navigate('ChatRoom', {
        conversationId: conversation.id,
        counterpartRole: isCustomer ? 'SELLER' : 'CUSTOMER',
      });
    },
    [navigation, isCustomer],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationResponse }) => (
      <ConversationItem item={item} isCustomer={isCustomer} onPress={handleRowPress} />
    ),
    [isCustomer, handleRowPress],
  );

  // 1. Guard against unauthenticated or unauthorized roles (Admin/Guest)
  if (!isAuthenticated || !isAuthorizedRole) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="conversation-list-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('chat.loginRequiredTitle', 'Yêu cầu đăng nhập')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t(
              'chat.loginRequiredDescList',
              'Bạn cần đăng nhập bằng tài khoản Người mua hoặc Người bán để xem tin nhắn.',
            )}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel={t('chat.loginButton', 'Đăng nhập')}
          >
            <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
              {t('chat.loginButton', 'Đăng nhập')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 2. Loading state
  if (isLoading && conversations.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="conversation-list-screen"
      >
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t('chat.loadingMessages', 'Đang tải tin nhắn…')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Error state with retry
  if (isError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="conversation-list-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {t('chat.loadFailedTitle', 'Không thể tải tin nhắn')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t(
              'chat.networkFailedDesc',
              'Vui lòng kiểm tra kết nối mạng và thử lại.',
            )}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: theme.primary },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel={t('chat.retry', 'Thử lại')}
          >
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>
              {t('chat.retry', 'Thử lại')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 4. Empty state tailored to Customer vs Seller
  if (conversations.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
        testID="conversation-list-screen"
      >
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {isCustomer
              ? t('chat.emptyCustomerTitle', 'Chưa có cuộc trò chuyện nào')
              : t('chat.emptySellerTitle', 'Chưa có tin nhắn từ khách hàng')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isCustomer
              ? t(
                  'chat.emptyCustomerDesc',
                  'Tin nhắn giữa bạn và các shop sẽ xuất hiện ở đây.',
                )
              : t(
                  'chat.emptySellerDesc',
                  'Các cuộc hội thoại từ khách hàng sẽ xuất hiện ở đây.',
                )}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.outlineButton,
              { borderColor: theme.border },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel={t('chat.refreshA11y', 'Làm mới danh sách tin nhắn')}
          >
            <Text style={[styles.outlineButtonText, { color: theme.text }]}>
              {t('chat.refresh', 'Làm mới')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 5. Populated conversation list
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top']}
      testID="conversation-list-screen"
    >
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor={theme.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  outlineButtonText: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
