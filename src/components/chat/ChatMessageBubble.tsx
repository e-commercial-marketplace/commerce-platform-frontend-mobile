/**
 * Chat message bubble component for Human Customer–Seller Chat.
 *
 * Sourced directly from backend MessageResponse DTO:
 * - Content rendering
 * - Outgoing vs incoming styling (senderId comparison)
 * - Safe image attachment rendering if imageUrl is present
 * - Formatted timestamp (formatChatTimestamp)
 * - Read indicator: subtle "Seen" for outgoing messages marked isRead: true
 *   (Strictly avoids fabricating "Sent" or "Received")
 * - Retry button for failed messages
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { MessageResponse } from '../../types/chatApi';
import { formatChatTimestamp } from '../../utils/format';

export type ChatMessageBubbleProps = {
  message:
    | MessageResponse
    | (Partial<MessageResponse> & {
        id: string;
        content: string;
        createdAt: string;
        senderId?: string;
        imageUrl?: string | null;
        isRead?: boolean;
      });
  isOutgoing: boolean;
  isFailed?: boolean;
  /** Message being sent (optimistic update): shown faded until the server confirms. */
  isPending?: boolean;
  onRetry?: () => void;
};

export const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
  isOutgoing,
  isFailed = false,
  isPending = false,
  onRetry,
}: ChatMessageBubbleProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const [imageError, setImageError] = useState(false);
  const formattedTime = formatChatTimestamp(message.createdAt);

  const senderPrefix = isOutgoing ? t('chat.you', 'You: ') : t('chat.partner', 'Partner: ');
  const contentOrImage = message.content || t('chat.imageFallback', 'Image');

  return (
    <View
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${senderPrefix}${contentOrImage}`}
    >
      <View
        style={[
          styles.bubble,
          isOutgoing
            ? [styles.outgoingBubble, { backgroundColor: theme.primary }]
            : [
                styles.incomingBubble,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ],
          isFailed && [
            styles.failedBubble,
            {
              backgroundColor: isDark ? '#3E1F1F' : '#FDE8E8',
              borderColor: theme.danger,
            },
          ],
          isPending && styles.pendingBubble,
        ]}
      >
        {/* Optional Attached Image */}
        {message.imageUrl && !imageError ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={[styles.attachedImage, { backgroundColor: theme.border }]}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityLabel={t('chat.attachedImageA11y', 'Attached image')}
          />
        ) : null}

        {/* Text Message Content */}
        {message.content ? (
          <Text
            style={[
              styles.messageText,
              isOutgoing
                ? [styles.outgoingText, { color: theme.onPrimary }]
                : [styles.incomingText, { color: theme.text }],
            ]}
            selectable
          >
            {message.content}
          </Text>
        ) : null}
      </View>

      {/* Meta Footer: Timestamp + Read Status / Failed Action */}
      <View
        style={[
          styles.metaRow,
          isOutgoing ? styles.outgoingMetaRow : styles.incomingMetaRow,
        ]}
      >
        <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
          {formattedTime}
        </Text>

        {/* Outgoing Read Indicator: Subtle "Seen" only when isRead is true */}
        {isOutgoing && !isFailed && message.isRead === true ? (
          <Text style={[styles.readStatusText, { color: theme.primary }]}>
            {t('chat.seen', 'Seen')}
          </Text>
        ) : null}

        {/* Failure State & Retry Button */}
        {isFailed ? (
          <View style={styles.failedActionRow}>
            <Text style={[styles.failedNotice, { color: theme.danger }]}>
              {`⚠️ ${t('chat.sendFailed', 'Send failed')}`}
            </Text>
            {onRetry ? (
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                  },
                  pressed && styles.retryButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('chat.retryBubbleA11y', 'Retry sending message')}
              >
                <Text style={[styles.retryButtonText, { color: theme.danger }]}>
                  {t('chat.retry', 'Retry')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    maxWidth: '85%',
  },
  outgoingContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxWidth: '100%',
  },
  outgoingBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  pendingBubble: {
    opacity: 0.6,
  },
  failedBubble: {
    backgroundColor: '#FDE8E8',
    borderColor: colors.danger,
    borderWidth: 1,
  },
  attachedImage: {
    width: 220,
    height: 150,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.border,
  },
  messageText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  outgoingText: {
    color: colors.onPrimary,
  },
  incomingText: {
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: 2,
  },
  outgoingMetaRow: {
    justifyContent: 'flex-end',
  },
  incomingMetaRow: {
    justifyContent: 'flex-start',
  },
  timestampText: {
    fontSize: typography.xs - 1,
    color: colors.textSecondary,
  },
  readStatusText: {
    fontSize: typography.xs - 1,
    color: colors.primary,
    fontWeight: '500',
  },
  failedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  failedNotice: {
    fontSize: typography.xs - 1,
    color: colors.danger,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    fontSize: typography.xs - 1,
    color: colors.danger,
    fontWeight: '600',
  },
});
