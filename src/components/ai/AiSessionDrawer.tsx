/**
 * Customer AI Session History Drawer / Modal (Phase 4).
 *
 * Displays previous AI chat sessions for authenticated CUSTOMER.
 * Allows switching / resuming sessions or starting a fresh chat.
 *
 * Contract:
 * - GET /api/v1/ai/sessions returns: { id, userId, createdAt }[]
 * - Deterministic date-based label: "Cuộc trò chuyện 30/10/2026, 08:30"
 * - Does not display raw UUID prominently.
 * - Supports loading, error with retry, and empty states.
 */

import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import { useAiSessions } from '../../hooks/useAi';
import type { AiChatSessionResponse } from '../../types/aiApi';

export type AiSessionDrawerProps = {
  visible: boolean;
  activeSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  restoringSessionId?: string | null;
  errorMessage?: string | null;
};

export function formatSessionDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

export default function AiSessionDrawer({
  visible,
  activeSessionId,
  onClose,
  onSelectSession,
  onNewChat,
  restoringSessionId,
  errorMessage,
}: AiSessionDrawerProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const { data: sessions, isLoading, isError, refetch } = useAiSessions({ enabled: visible });

  const sortedSessions = React.useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [sessions]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="ai-session-drawer-modal"
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('ai.drawerCloseA11y', 'Đóng lịch sử trò chuyện')}
        />

        <SafeAreaView
          style={[styles.sheet, { backgroundColor: theme.background }]}
          edges={['bottom', 'top']}
        >
          {/* Drawer Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {t('ai.drawerTitle', 'Lịch sử trò chuyện')}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={[
                  styles.newChatHeaderBtn,
                  {
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                  },
                ]}
                onPress={onNewChat}
                accessibilityRole="button"
                accessibilityLabel={t('ai.newChatA11y', 'Đoạn chat mới')}
              >
                <Text style={[styles.newChatHeaderBtnText, { color: theme.primary }]}>
                  {t('ai.newChatDrawerBtn', '＋ Đoạn chat mới')}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.closeBtn,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Đóng lịch sử"
              >
                <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Error Banner if restoration or session switch failed */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: theme.danger }]}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {/* Drawer Body */}
          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.stateText, { color: theme.textSecondary }]}>
                {t('ai.loadingHistory', 'Đang tải lịch sử...')}
              </Text>
            </View>
          ) : isError ? (
            <View style={styles.stateContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={[styles.errorText, { color: theme.text }]}>
                {t('ai.loadHistoryFailed', 'Không thể tải danh sách phiên trò chuyện.')}
              </Text>
              <Pressable
                style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                onPress={() => refetch()}
                accessibilityRole="button"
                accessibilityLabel={t('ai.retry', 'Thử lại')}
              >
                <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>
                  {t('ai.retry', 'Thử lại')}
                </Text>
              </Pressable>
            </View>
          ) : sortedSessions.length === 0 ? (
            <View style={styles.stateContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {t('ai.emptyHistoryTitle', 'Chưa có cuộc trò chuyện nào.')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {t(
                  'ai.emptyHistorySubtitle',
                  'Các cuộc trò chuyện của bạn sẽ được lưu tại đây.',
                )}
              </Text>
            </View>
          ) : (
            <FlatList
              data={sortedSessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isActive = item.id === activeSessionId;
                const isRestoring = item.id === restoringSessionId;
                const dateLabel = formatSessionDate(item.createdAt);
                const displayTitle = t('ai.sessionDatePrefix', `Cuộc trò chuyện ${dateLabel}`, {
                  date: dateLabel,
                });

                return (
                  <Pressable
                    style={[
                      styles.sessionCard,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                      isActive && [
                        styles.sessionCardActive,
                        {
                          borderColor: theme.primary,
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F0F9FF',
                        },
                      ],
                    ]}
                    onPress={() => onSelectSession(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={displayTitle}
                    disabled={isRestoring}
                  >
                    <View style={styles.sessionCardLeft}>
                      <View
                        style={[
                          styles.sessionIconWrap,
                          { backgroundColor: isDark ? '#262626' : '#F3F4F6' },
                          isActive && [
                            styles.sessionIconWrapActive,
                            { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#DBEAFE' },
                          ],
                        ]}
                      >
                        <Text style={styles.sessionIcon}>💬</Text>
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text
                          style={[
                            styles.sessionTitle,
                            { color: theme.text },
                            isActive && [styles.sessionTitleActive, { color: theme.primary }],
                          ]}
                          numberOfLines={1}
                        >
                          {displayTitle}
                        </Text>
                        <Text style={[styles.sessionDate, { color: theme.textSecondary }]}>
                          {dateLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sessionCardRight}>
                      {isActive ? (
                        <View
                          style={[
                            styles.activeBadge,
                            {
                              backgroundColor: isDark
                                ? 'rgba(59, 130, 246, 0.25)'
                                : '#DBEAFE',
                            },
                          ]}
                        >
                          <Text style={[styles.activeBadgeText, { color: theme.primary }]}>
                            {t('ai.activeSession', 'Đang mở')}
                          </Text>
                        </View>
                      ) : null}

                      {isRestoring ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '80%',
    minHeight: '40%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newChatHeaderBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  newChatHeaderBtnText: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBannerText: {
    fontSize: typography.xs,
    color: '#B91C1C',
    lineHeight: 18,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 200,
  },
  stateText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: typography.sm,
    color: colors.text,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  retryBtnText: {
    color: colors.onPrimary,
    fontSize: typography.xs,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sessionCard: {
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
  sessionCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  sessionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  sessionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionIconWrapActive: {
    backgroundColor: '#DBEAFE',
  },
  sessionIcon: {
    fontSize: 16,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  sessionTitleActive: {
    color: colors.primary,
  },
  sessionDate: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  sessionCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: '#DBEAFE',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  chevron: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: '400',
  },
});
