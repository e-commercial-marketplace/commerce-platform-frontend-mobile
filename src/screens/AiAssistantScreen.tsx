/**
 * AI Assistant Screen - Core conversational interface (Phases 2–5).
 *
 * Capabilities:
 * - Empty state with friendly greeting and quick prompt suggestions.
 * - Live conversational turn list (USER and ASSISTANT message bubbles).
 * - Distinguishes AI vs RULES (quick fallback) answers via subtle badge.
 * - Rich product recommendation cards for assistant search turns.
 * - Active session tracking for authenticated CUSTOMER.
 * - Session history drawer / resume previous conversation.
 * - "New chat" action to start a fresh conversation.
 * - Session cache invalidation on first new authenticated turn.
 * - Race-safe session switching and defensive error handling (400, 401, 403, 404, 429, network, timeout).
 * - Per-turn failure state with explicit single-tap "Retry" action (without duplicating user turns).
 * - Stale response guard preventing late AI responses from contaminating switched/reset chats.
 * - Subtle character counter (near 900/1000 limit) keeping composer uncluttered.
 * - Stateless guest access: requests omit sessionId; conversations remain local.
 * - Synchronous double-send prevention.
 * - Graceful access restriction for SELLER and ADMIN roles.
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';

import { toApiError } from '../api/errors';
import { queryKeys } from '../api/queryKeys';
import AiMessageBubble, { type ChatUiMessage } from '../components/ai/AiMessageBubble';
import AiSessionDrawer from '../components/ai/AiSessionDrawer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useAiSessionMessages, useAskAi } from '../hooks/useAi';
import type { AppNavigatorScreenProps } from '../navigation/types';
import type { AiAskRequest, AiProductResponse } from '../types/aiApi';

const SUGGESTED_PROMPTS = [
  'Find noise-cancelling headphones under 2 million',
  'Suggest well-rated laptops',
  'What payment methods are available?',
  'What is the order cancellation policy?',
];

export default function AiAssistantScreen({ navigation }: AppNavigatorScreenProps<'AiAssistant'>) {
  const { user, isAuthenticated } = useAuth();
  const isCustomer = isAuthenticated && user?.role === 'CUSTOMER';
  const isSellerOrAdmin = user?.role === 'SELLER' || user?.role === 'ADMIN';

  let queryClient: ReturnType<typeof useQueryClient> | undefined;
  try {
    queryClient = useQueryClient();
  } catch {
    // Graceful fallback for test environments without QueryClientProvider
  }

  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Session History drawer state
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [drawerLoadError, setDrawerLoadError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<ChatUiMessage>>(null);
  const isSendingRef = useRef(false);
  const prevIsCustomerRef = useRef(isCustomer);

  // Stale response guard token: increments whenever conversation context resets or switches
  const conversationGenRef = useRef(0);

  const askAiMutation = useAskAi();

  // Fetch historical messages when a session is selected
  const sessionMessagesQuery = useAiSessionMessages(selectedSessionId, {
    enabled: isCustomer && Boolean(selectedSessionId),
  });

  // Handle restoration of selected session messages
  useEffect(() => {
    if (!selectedSessionId) return;

    if (sessionMessagesQuery.isSuccess && sessionMessagesQuery.data) {
      // Sort messages chronologically
      const sorted = [...sessionMessagesQuery.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Map to ChatUiMessage: historical messages have no answeredBy and no products
      const restored: ChatUiMessage[] = sorted.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      }));

      setMessages(restored);
      setActiveSessionId(selectedSessionId);
      setErrorBanner(null);
      setDrawerLoadError(null);
      setHistoryDrawerVisible(false);
      setSelectedSessionId(null);
    } else if (sessionMessagesQuery.isError) {
      const apiError = toApiError(sessionMessagesQuery.error);
      let errorMsg = 'Could not load the conversation. Please try again.';

      if (apiError.status === 404 || apiError.code === 'RESOURCE_NOT_FOUND') {
        errorMsg = 'This conversation no longer exists.';
        if (activeSessionId === selectedSessionId) {
          setActiveSessionId(null);
        }
      } else if (apiError.status === 403) {
        errorMsg = 'You do not have permission to view this conversation.';
      } else if (apiError.message && !apiError.message.includes('status code')) {
        errorMsg = apiError.message;
      }

      setDrawerLoadError(errorMsg);
      setErrorBanner(errorMsg);
      setSelectedSessionId(null);
      // NOTE: Current messages are preserved intact on load failure!
    }
  }, [
    selectedSessionId,
    sessionMessagesQuery.isSuccess,
    sessionMessagesQuery.isError,
    sessionMessagesQuery.data,
    sessionMessagesQuery.error,
    activeSessionId,
  ]);

  // Auth transition handler: clear restored sessions when customer logs out
  useEffect(() => {
    if (prevIsCustomerRef.current && !isCustomer) {
      conversationGenRef.current += 1;
      setActiveSessionId(null);
      setHistoryDrawerVisible(false);
      setMessages([]);
      setErrorBanner(null);
      setDrawerLoadError(null);
      setSelectedSessionId(null);
    } else if (!isCustomer) {
      setActiveSessionId(null);
    }
    prevIsCustomerRef.current = isCustomer;
  }, [isCustomer]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, askAiMutation.isPending]);

  // Track dynamic keyboard height on Android and scroll messages to bottom on keyboard open
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (Platform.OS === 'android') {
        const height = e.endCoordinates?.height ?? 0;
        setKeyboardHeight(height);
      }
      if (messages.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
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
  }, [messages.length]);

  function handleProductPress(product: AiProductResponse) {
    navigation.navigate('ProductDetail', { productId: product.id });
  }

  function handleNewChat() {
    conversationGenRef.current += 1;
    setActiveSessionId(null);
    setMessages([]);
    setErrorBanner(null);
    setDrawerLoadError(null);
    setSelectedSessionId(null);
    setHistoryDrawerVisible(false);
  }

  function handleSelectSession(sessionId: string) {
    conversationGenRef.current += 1;
    setDrawerLoadError(null);
    setSelectedSessionId(sessionId);
  }

  async function sendTurn(trimmedText: string, existingUserMessageId?: string) {
    if (!trimmedText || isSendingRef.current || askAiMutation.isPending || isSellerOrAdmin) {
      return;
    }

    if (trimmedText.length > 1000) {
      setErrorBanner('The question must not exceed 1000 characters.');
      return;
    }

    // Synchronous lock against rapid multi-taps
    isSendingRef.current = true;
    setErrorBanner(null);

    // Capture current conversation generation token
    const turnGen = conversationGenRef.current;

    const userMessageId =
      existingUserMessageId ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (!existingUserMessageId) {
      const userMessage: ChatUiMessage = {
        id: userMessageId,
        role: 'USER',
        content: trimmedText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
    }

    // Construct request. Resolves session state dynamically at SEND time!
    const request: AiAskRequest = {
      message: trimmedText,
      ...(isCustomer && activeSessionId ? { sessionId: activeSessionId } : {}),
    };

    const isFirstAuthenticatedTurn = isCustomer && !activeSessionId;

    try {
      const response = await askAiMutation.mutateAsync(request);

      // Stale response guard: discard if chat was reset or switched while in flight
      if (conversationGenRef.current !== turnGen) {
        return;
      }

      // Customer receives new session ID from backend on first turn
      if (isCustomer && response.sessionId) {
        setActiveSessionId(response.sessionId);
        // Refresh session list so drawer displays newly created session
        if (isFirstAuthenticatedTurn && queryClient) {
          queryClient.invalidateQueries({ queryKey: queryKeys.ai.sessions() });
        }
      }

      const assistantMessage: ChatUiMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'ASSISTANT',
        content: response.answer,
        answeredBy: response.answeredBy,
        products: response.products,
        query: response.query,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      // Discard error if conversation context changed while in flight
      if (conversationGenRef.current !== turnGen) {
        return;
      }

      // Mark the user message as failed so retry button is available
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, isFailed: true } : m)),
      );

      const apiError = toApiError(err);
      let userFacingError = 'Could not get an answer right now. Please try again.';

      if (apiError.status === 400 || apiError.code === 'VALIDATION_ERROR') {
        userFacingError = 'Please check the question again.';
      } else if (apiError.status === 429 || apiError.code === 'RATE_LIMITED') {
        userFacingError =
          'You have asked too many questions in 1 minute. Please wait a moment and try again.';
      } else if (apiError.status === 404 || apiError.code === 'RESOURCE_NOT_FOUND') {
        // Stale or deleted session: reset local activeSessionId so next turn creates a fresh session
        setActiveSessionId(null);
        userFacingError =
          'The previous conversation session has ended. The next question will start a new conversation.';
      } else if (apiError.status === 403) {
        userFacingError = 'You do not have permission to perform this action.';
      } else if (
        apiError.code === 'NETWORK_ERROR' ||
        apiError.code === 'TIMEOUT_ERROR' ||
        apiError.status === null
      ) {
        userFacingError = 'Could not connect to the assistant right now. Please try again.';
      } else if (apiError.message && !apiError.message.includes('status code')) {
        userFacingError = apiError.message;
      }

      setErrorBanner(userFacingError);
    } finally {
      isSendingRef.current = false;
    }
  }

  async function handleSend(textToSend?: string) {
    const raw = textToSend ?? inputText;
    const trimmed = raw.trim();
    await sendTurn(trimmed);
  }

  async function handleRetry(failedMessage: ChatUiMessage) {
    if (isSendingRef.current || askAiMutation.isPending || isSellerOrAdmin) {
      return;
    }

    // Reset failed status on existing bubble while retrying
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMessage.id ? { ...m, isFailed: false } : m)),
    );

    await sendTurn(failedMessage.content, failedMessage.id);
  }

  // Gracefully block access if seller or admin navigates directly
  if (isSellerOrAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.blockedState}>
          <Text style={styles.blockedIcon}>ℹ️</Text>
          <Text style={styles.blockedTitle}>AI shopping assistant</Text>
          <Text style={styles.blockedMessage}>
            The AI assistant is only available to Customers and Guests for searching products and answering
            policy questions.
          </Text>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isSendDisabled = inputText.trim().length === 0 || askAiMutation.isPending;

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
        {/* Top Action Bar for Customer History and New Chat */}
        <View style={styles.topBar}>
          {isCustomer ? (
            <Pressable
              style={styles.topBarButton}
              onPress={() => {
                setDrawerLoadError(null);
                setHistoryDrawerVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="History"
            >
              <Text style={styles.topBarButtonIcon}>🕒</Text>
              <Text style={styles.topBarButtonText}>History</Text>
            </Pressable>
          ) : null}

          {isCustomer || messages.length > 0 ? (
            <Pressable
              style={[styles.topBarButton, styles.newChatButton]}
              onPress={handleNewChat}
              accessibilityRole="button"
              accessibilityLabel="New chat"
            >
              <Text style={styles.newChatButtonIcon}>＋</Text>
              <Text style={styles.newChatButtonText}>New chat</Text>
            </Pressable>
          ) : null}
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyHeader}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarIcon}>✨</Text>
              </View>
              <Text style={styles.emptyTitle}>Hello! I am your shopping assistant.</Text>
              <Text style={styles.emptySubtitle}>
                Do you want to find a product or ask something about the store?
              </Text>
            </View>

            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsHeading}>Suggested questions:</Text>
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <Pressable
                  key={index}
                  style={styles.promptPill}
                  onPress={() => handleSend(prompt)}
                  accessibilityRole="button"
                  accessibilityLabel={prompt}
                >
                  <Text style={styles.promptPillText}>{prompt}</Text>
                  <Text style={styles.promptPillArrow}>→</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AiMessageBubble
                message={item}
                onProductPress={handleProductPress}
                onRetry={handleRetry}
              />
            )}
            style={styles.messageListContainer}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              askAiMutation.isPending ? (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.typingText}>The assistant is thinking...</Text>
                </View>
              ) : undefined
            }
          />
        )}

        {errorBanner ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorBanner}</Text>
            <Pressable
              onPress={() => setErrorBanner(null)}
              accessibilityRole="button"
              accessibilityLabel="Close error notice"
            >
              <Text style={styles.errorBannerClose}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composerWrapper}>
          <TextInput
            style={styles.composerInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about products, policies..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            editable={!askAiMutation.isPending}
            accessibilityLabel="Enter a question for the AI assistant"
          />

          {inputText.length >= 900 ? (
            <Text style={styles.charCounter} testID="composer-char-counter">
              {inputText.length}/1000
            </Text>
          ) : null}

          <Pressable
            style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={isSendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Send question"
          >
            <Text style={[styles.sendButtonIcon, isSendDisabled && styles.sendButtonIconDisabled]}>
              ↑
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Customer Session History Drawer */}
      {isCustomer ? (
        <AiSessionDrawer
          visible={historyDrawerVisible}
          activeSessionId={activeSessionId}
          onClose={() => setHistoryDrawerVisible(false)}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          restoringSessionId={selectedSessionId}
          errorMessage={drawerLoadError}
        />
      ) : null}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 40,
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  topBarButtonIcon: {
    fontSize: 14,
  },
  topBarButtonText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  newChatButton: {
    marginLeft: 'auto',
  },
  newChatButtonIcon: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  newChatButtonText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  emptyHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  suggestionsWrap: {
    gap: spacing.sm,
  },
  suggestionsHeading: {
    fontSize: typography.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  promptPillText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  promptPillArrow: {
    fontSize: typography.base,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  typingText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBannerText: {
    fontSize: typography.xs,
    color: '#B91C1C',
    flex: 1,
    marginRight: spacing.sm,
  },
  errorBannerClose: {
    fontSize: typography.sm,
    color: '#991B1B',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  composerWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: typography.base,
    color: colors.text,
  },
  charCounter: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    alignSelf: 'center',
    paddingHorizontal: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendButtonIcon: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sendButtonIconDisabled: {
    color: '#9CA3AF',
  },
  blockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  blockedIcon: {
    fontSize: 40,
  },
  blockedTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  blockedMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  backButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.sm,
  },
});
