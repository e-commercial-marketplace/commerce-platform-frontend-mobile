/**
 * Message bubble for AI Assistant conversations (Phases 2–5).
 *
 * Distinct styling for USER vs ASSISTANT turns:
 * - USER: right-aligned, primary blue theme, white text.
 *   When send fails (isFailed === true): red background, "Gửi không thành công" status, and explicit "Thử lại" action.
 * - ASSISTANT: left-aligned, light neutral surface, dark text, subtle answer-source indicator.
 *
 * Source indicator:
 * - answeredBy === 'AI'    -> "AI" (✨)
 * - answeredBy === 'RULES' -> "Trả lời nhanh" (⚡ - valid backend rule-based fallback, never shown as error)
 * - answeredBy === undefined -> No badge (historical restored messages)
 *
 * Rich Product Recommendations:
 * - Assistant turns with returned products render a horizontal scrollable row of AiProductCards.
 * - Uses horizontal ScrollView (avoids nested FlatList VirtualizedList warnings).
 * - Never renders product cards for USER turns or empty product arrays.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AiProductCard from './AiProductCard';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { AiAnswerSource, AiProductQueryResponse, AiProductResponse } from '../../types/aiApi';

export type ChatUiMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  answeredBy?: AiAnswerSource;
  /** Preserved for rich product recommendation cards */
  products?: AiProductResponse[];
  query?: AiProductQueryResponse | null;
  createdAt?: string;
  isFailed?: boolean;
};

type AiMessageBubbleProps = {
  message: ChatUiMessage;
  onProductPress?: (product: AiProductResponse) => void;
  onRetry?: (message: ChatUiMessage) => void;
};

export default function AiMessageBubble({
  message,
  onProductPress,
  onRetry,
}: AiMessageBubbleProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const isUser = message.role === 'USER';

  if (isUser) {
    return (
      <View style={[styles.bubbleWrapper, styles.userBubbleWrapper]}>
        <View
          style={[
            styles.bubble,
            styles.userBubble,
            { backgroundColor: theme.primary },
            message.isFailed && [
              styles.failedBubble,
              { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#DC2626' },
            ],
          ]}
        >
          <Text style={[styles.userText, { color: theme.onPrimary }]}>{message.content}</Text>
        </View>

        {message.isFailed ? (
          <View style={styles.failedRow}>
            <Text
              style={[
                styles.failedText,
                { color: isDark ? '#FCA5A5' : '#DC2626' },
              ]}
            >
              {t('ai.failedToSend', 'Gửi không thành công')}
            </Text>
            {onRetry ? (
              <Pressable
                onPress={() => onRetry(message)}
                style={[
                  styles.retryBubbleBtn,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('ai.retryA11y', 'Thử lại gửi câu hỏi')}
              >
                <Text
                  style={[
                    styles.retryBubbleBtnText,
                    { color: isDark ? '#FCA5A5' : '#B91C1C' },
                  ]}
                >
                  {t('ai.retry', 'Thử lại')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  const isRules = message.answeredBy === 'RULES';
  const hasProducts = Boolean(message.products && message.products.length > 0);

  return (
    <View style={[styles.bubbleWrapper, styles.assistantBubbleWrapper]}>
      <View
        style={[
          styles.bubble,
          styles.assistantBubble,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.assistantText, { color: theme.text }]}>{message.content}</Text>

        {message.answeredBy ? (
          <View
            style={[
              styles.sourceTag,
              {
                backgroundColor: isDark ? '#262626' : '#F3F4F6',
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={styles.sourceTagIcon}>{isRules ? '⚡' : '✨'}</Text>
            <Text style={[styles.sourceTagText, { color: theme.textSecondary }]}>
              {isRules ? t('ai.answeredByRules', 'Trả lời nhanh') : t('ai.answeredByAi', 'AI')}
            </Text>
          </View>
        ) : null}
      </View>

      {hasProducts ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.productListScroll}
          contentContainerStyle={styles.productListContent}
        >
          {message.products!.map((product) => (
            <AiProductCard
              key={product.id}
              product={product}
              onPress={onProductPress ?? (() => {})}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleWrapper: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  userBubbleWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  assistantBubbleWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  failedBubble: {
    backgroundColor: '#DC2626',
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginRight: 4,
  },
  failedText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
  retryBubbleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  retryBubbleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: colors.onPrimary,
    fontSize: typography.base,
    lineHeight: 22,
  },
  assistantText: {
    color: colors.text,
    fontSize: typography.base,
    lineHeight: 22,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.xs + 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: '#F3F4F6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  sourceTagIcon: {
    fontSize: 10,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  productListScroll: {
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
    alignSelf: 'stretch',
  },
  productListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
