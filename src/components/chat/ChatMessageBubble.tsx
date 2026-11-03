/**
 * Chat message bubble component for Human Customer–Seller Chat.
 *
 * Sourced directly from backend MessageResponse DTO:
 * - Content rendering
 * - Outgoing vs incoming styling (senderId comparison)
 * - Safe image attachment rendering if imageUrl is present
 * - Formatted timestamp (formatChatTimestamp)
 * - Read indicator: subtle "Đã xem" for outgoing messages marked isRead: true
 *   (Strictly avoids fabricating "Đã gửi" or "Đã nhận")
 * - Retry button for failed messages
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
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
  /** Tin đang gửi (cập nhật lạc quan): hiện mờ cho tới khi server xác nhận. */
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
  const [imageError, setImageError] = useState(false);
  const formattedTime = formatChatTimestamp(message.createdAt);

  return (
    <View
      style={[
        styles.container,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${isOutgoing ? 'Bạn: ' : 'Đối tác: '}${message.content || 'Hình ảnh'}`}
    >
      <View
        style={[
          styles.bubble,
          isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
          isFailed && styles.failedBubble,
          isPending && styles.pendingBubble,
        ]}
      >
        {/* Optional Attached Image (Render-only fallback, upload is unsupported) */}
        {message.imageUrl && !imageError ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.attachedImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityLabel="Hình ảnh đính kèm"
          />
        ) : null}

        {/* Message Content Text */}
        {message.content ? (
          <Text
            style={[
              styles.messageText,
              isOutgoing ? styles.outgoingText : styles.incomingText,
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
        <Text style={styles.timestampText}>{formattedTime}</Text>

        {/* Outgoing Read Indicator: Subtle "Đã xem" only when isRead is true */}
        {isOutgoing && !isFailed && message.isRead === true ? (
          <Text style={styles.readStatusText}>Đã xem</Text>
        ) : null}

        {/* Failure State & Retry Button */}
        {isFailed ? (
          <View style={styles.failedActionRow}>
            <Text style={styles.failedNotice}>⚠️ Lỗi gửi</Text>
            {onRetry ? (
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Thử lại gửi tin nhắn"
              >
                <Text style={styles.retryButtonText}>Thử lại</Text>
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
