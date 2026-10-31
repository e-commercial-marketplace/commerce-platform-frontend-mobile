/**
 * Human Customer–Seller Chat Room Screen.
 *
 * Sourced directly from backend REST and WebSocket contracts:
 * - Paginated message history (GET /conversations/{id}/messages) via useConversationMessages.
 * - Inverted FlatList with infinite scroll for older messages (onEndReached).
 * - Real-time incoming messages via WebSocket push (ChatMessageCreatedEvent).
 * - Outgoing messages sent via POST /conversations/{id}/messages with client Idempotency-Key.
 * - Retry capability for failed messages reusing the EXACT same idempotency key.
 * - Mark conversation read via PATCH /conversations/{id}/read.
 * - Real-time read receipts (MessagesReadEvent) reflected on outgoing messages ("Đã xem").
 * - Role-based authorization: CUSTOMER and SELLER only.
 * - Android/iOS responsive keyboard avoidance.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatMessageBubble } from '../components/chat/ChatMessageBubble';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import {
  useConversationMessages,
  useConversations,
  useMarkConversationRead,
  useSendMessage,
} from '../hooks/useChat';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useSellerShop } from '../hooks/useSellers';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { MessageResponse } from '../types/chatApi';
import { generateClientMessageKey } from '../utils/chatIdempotency';

export type FailedMessage = {
  tempId: string;
  idempotencyKey: string;
  content: string;
  createdAt: string;
  senderId: string;
  isFailed: true;
};

type DisplayItem = MessageResponse | FailedMessage;

export default function ChatRoomScreen({
  route,
  navigation,
}: AppNavigatorScreenProps<'ChatRoom'>) {
  const { conversationId, counterpartName } = route.params;

  const { user, isAuthenticated } = useAuth();
  const isCustomer = user?.role === 'CUSTOMER';
  const isSeller = user?.role === 'SELLER';
  const isAuthorizedRole = isCustomer || isSeller;

  // Real-time WebSocket connection
  const { connectionState, reconnect } = useChatWebSocket();

  // Load conversation details from cached conversations query to resolve counterpart shop/buyer
  const { data: conversations = [] } = useConversations(isAuthenticated && isAuthorizedRole);
  const currentConversation = conversations.find((c) => c.id === conversationId);

  // If customer, fetch seller's shop name
  const sellerId = isCustomer ? currentConversation?.sellerId : '';
  const { data: shop } = useSellerShop(sellerId ?? '');

  // Resolve counterpart display name
  const resolvedTitle = useMemo(() => {
    if (counterpartName) return counterpartName;
    if (isCustomer) {
      if (shop?.name) return shop.name;
      if (currentConversation?.sellerId) {
        return `Shop #${currentConversation.sellerId.slice(0, 8)}`;
      }
      return 'Cửa hàng';
    }
    if (isSeller) {
      if (currentConversation?.customerId) {
        return `Khách hàng #${currentConversation.customerId.slice(0, 8)}`;
      }
      return 'Khách hàng';
    }
    return 'Trò chuyện';
  }, [counterpartName, isCustomer, isSeller, shop?.name, currentConversation]);

  // Synchronize screen title with resolved counterpart name
  useEffect(() => {
    navigation.setOptions({ title: resolvedTitle });
  }, [navigation, resolvedTitle]);

  // Paginated message history
  const {
    data: messagesData,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationMessages(conversationId, {
    enabled: isAuthenticated && isAuthorizedRole && Boolean(conversationId),
  });

  // Flattened history messages (ordered newest first by backend)
  const historyMessages: MessageResponse[] = useMemo(() => {
    if (!messagesData?.pages) return [];
    return messagesData.pages.flatMap((page) => page.content);
  }, [messagesData]);

  // Local failed messages tracking (preserves idempotencyKey across retries)
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);

  // Message mutation & Mark read mutation
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkConversationRead();

  // Text composer state
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isSendingRef = useRef(false);

  // Track dynamic keyboard height on Android to prevent composer overlap
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (Platform.OS === 'android') {
        const height = e.endCoordinates?.height ?? 0;
        setKeyboardHeight(height);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (Platform.OS === 'android') {
        setKeyboardHeight(0);
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Combined display list: In an inverted FlatList, index 0 is rendered at the visual bottom.
  // Failed messages (latest user attempts) appear at the bottom above the composer.
  const displayItems: DisplayItem[] = useMemo(() => {
    return [...failedMessages, ...historyMessages];
  }, [failedMessages, historyMessages]);

  // Mark conversation read on mount and when unread counterpart messages arrive
  useEffect(() => {
    if (!conversationId || !isAuthenticated || !isAuthorizedRole) return;
    markReadMutation.mutate(conversationId);
  }, [conversationId, isAuthenticated, isAuthorizedRole]);

  useEffect(() => {
    if (!conversationId || !isAuthenticated || !isAuthorizedRole || !user?.id) return;
    const hasUnreadCounterpartMessages = historyMessages.some(
      (m) => m.senderId !== user.id && !m.isRead,
    );
    if (hasUnreadCounterpartMessages) {
      markReadMutation.mutate(conversationId);
    }
  }, [conversationId, historyMessages, isAuthenticated, isAuthorizedRole, user?.id]);

  // Send message with caller-controlled Idempotency-Key
  const handleSendMessage = useCallback(
    async (contentToSend?: string, existingKey?: string) => {
      const content = (contentToSend ?? inputText).trim();
      if (!content || isSendingRef.current || !user) return;

      isSendingRef.current = true;
      const idempotencyKey = existingKey ?? generateClientMessageKey();

      // Clear input on new message
      if (!contentToSend) {
        setInputText('');
      }

      // If retrying, optimistically remove from failedMessages
      if (existingKey) {
        setFailedMessages((prev) => prev.filter((m) => m.idempotencyKey !== existingKey));
      }

      try {
        await sendMessageMutation.mutateAsync({
          conversationId,
          request: { content },
          idempotencyKey,
        });
      } catch (error) {
        // Retain failed message with EXACT same idempotencyKey for subsequent retry
        const failedItem: FailedMessage = {
          tempId: `failed_${idempotencyKey}`,
          idempotencyKey,
          content,
          createdAt: new Date().toISOString(),
          senderId: user.id,
          isFailed: true,
        };
        setFailedMessages((prev) => [
          failedItem,
          ...prev.filter((m) => m.idempotencyKey !== idempotencyKey),
        ]);
      } finally {
        isSendingRef.current = false;
      }
    },
    [inputText, user, conversationId, sendMessageMutation],
  );

  // Older-message pagination handler (triggered when user scrolls towards top in inverted list)
  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 1. Gating against unauthenticated or unauthorized roles (Admin/Guest)
  if (!isAuthenticated || !isAuthorizedRole) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerState}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Yêu cầu đăng nhập</Text>
          <Text style={styles.subtitle}>
            Bạn cần đăng nhập bằng tài khoản Người mua hoặc Người bán để tham gia trò chuyện.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Đăng nhập"
          >
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSendDisabled = inputText.trim().length === 0 || sendMessageMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={[
          styles.keyboardContainer,
          Platform.OS === 'android' && keyboardHeight > 0 && { paddingBottom: keyboardHeight },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Real-time Connection Status Notice */}
        {connectionState === 'disconnected' || connectionState === 'reconnecting' ? (
          <View style={styles.connectionBanner} accessibilityRole="alert">
            <Text style={styles.connectionText}>
              {connectionState === 'reconnecting'
                ? 'Đang kết nối lại thời gian thực…'
                : 'Mất kết nối thời gian thực'}
            </Text>
            {connectionState === 'disconnected' ? (
              <Pressable
                onPress={reconnect}
                accessibilityRole="button"
                accessibilityLabel="Kết nối lại"
              >
                <Text style={styles.reconnectButtonText}>Kết nối lại</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Message List Area */}
        <View style={styles.listContainer}>
          {isLoading && displayItems.length === 0 ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.subtitle}>Đang tải tin nhắn…</Text>
            </View>
          ) : isError && displayItems.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTitle}>Không thể tải tin nhắn</Text>
              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                onPress={() => refetch()}
                accessibilityRole="button"
                accessibilityLabel="Thử lại"
              >
                <Text style={styles.primaryButtonText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : displayItems.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
              <Text style={styles.subtitle}>
                Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.
              </Text>
            </View>
          ) : (
            <FlatList
              inverted
              data={displayItems}
              keyExtractor={(item) =>
                'isFailed' in item && item.isFailed ? item.tempId : (item as MessageResponse).id
              }
              renderItem={({ item }) => {
                const isFailed = 'isFailed' in item && item.isFailed === true;
                const isOutgoing = item.senderId === user?.id;
                return (
                  <ChatMessageBubble
                    message={item as MessageResponse}
                    isOutgoing={isOutgoing}
                    isFailed={isFailed}
                    onRetry={
                      isFailed
                        ? () =>
                            handleSendMessage(
                              item.content,
                              (item as FailedMessage).idempotencyKey,
                            )
                        : undefined
                    }
                  />
                );
              }}
              onEndReached={handleLoadOlder}
              onEndReachedThreshold={0.2}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingOlderText}>Đang tải tin nhắn cũ hơn…</Text>
                  </View>
                ) : undefined
              }
              contentContainerStyle={styles.messageListContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Text Composer */}
        <View style={styles.composerWrapper}>
          <TextInput
            style={styles.composerInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            editable={!sendMessageMutation.isPending}
            accessibilityLabel="Nhập tin nhắn"
          />

          <Pressable
            style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
            disabled={isSendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text
                style={[
                  styles.sendButtonIcon,
                  isSendDisabled && styles.sendButtonIconDisabled,
                ]}
              >
                ↑
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  connectionBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  connectionText: {
    fontSize: typography.xs,
    color: '#92400E',
    fontWeight: '500',
  },
  reconnectButtonText: {
    fontSize: typography.xs,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listContainer: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingOlderContainer: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  loadingOlderText: {
    fontSize: typography.xs - 1,
    color: colors.textSecondary,
  },
  composerWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: typography.sm,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonIcon: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sendButtonIconDisabled: {
    color: colors.textSecondary,
  },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.sm,
  },
});
