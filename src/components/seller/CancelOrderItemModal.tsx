/**
 * Modal dialog for confirming Seller Order Item cancellation.
 *
 * Implements:
 * - Optional cancellation reason field (up to 1000 characters per backend contract)
 * - Trims textual reason if present; sends undefined if blank
 * - Prevents duplicate submission while isSubmitting is true
 * - Allows seller to dismiss/back out
 * - Displays backend-derived error messages (e.g. cannot cancel after shipment/payment)
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAppTheme } from '../../theme';
import { useAppLanguage } from '../../i18n';
import type { SellerOrderItem } from '../../types/sellerApi';

type CancelOrderItemModalProps = {
  visible: boolean;
  item: SellerOrderItem | null;
  onClose: () => void;
  onConfirmCancel: (item: SellerOrderItem, cancelReason?: string) => Promise<void>;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export default function CancelOrderItemModal({
  visible,
  item,
  onClose,
  onConfirmCancel,
  isSubmitting = false,
  errorMessage = null,
}: CancelOrderItemModalProps) {
  const { theme, isDark } = useAppTheme();
  const { t } = useAppLanguage();
  const [cancelReason, setCancelReason] = useState('');

  if (!item) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    setCancelReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (isSubmitting) {
      return;
    }
    const trimmed = cancelReason.trim();
    void onConfirmCancel(item, trimmed.length > 0 ? trimmed : undefined);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          style={styles.outsidePress}
          onPress={isSubmitting ? undefined : handleClose}
        />
        <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t('seller.cancelItem', 'Cancel Order Item')}
            </Text>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close cancellation dialog"
            >
              <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.warningMessage, { color: theme.textSecondary }]}>
              {t(
                'seller.unlistPromptMsg',
                'Are you sure you want to cancel this order item? This will release stock back to your inventory and update the order balance.',
              )}
            </Text>

            <View
              style={[
                styles.itemSummary,
                { backgroundColor: theme.background, borderLeftColor: theme.danger },
              ]}
            >
              <Text style={[styles.productName, { color: theme.text }]} numberOfLines={2}>
                {item.productName}
              </Text>
              <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                Quantity: {item.quantity} • Order #{item.orderId.slice(0, 8)}
              </Text>
            </View>

            <View style={styles.reasonHeaderRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t('seller.descriptionLabel', 'Cancellation Reason (Optional)')}
              </Text>
              <Text
                style={[
                  styles.charCount,
                  { color: theme.textSecondary },
                  cancelReason.length > 1000 && styles.charCountOver,
                ]}
              >
                {cancelReason.length}/1000
              </Text>
            </View>

            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
                errorMessage != null && [styles.textAreaError, { borderColor: theme.danger }],
              ]}
              multiline
              numberOfLines={3}
              placeholder={t(
                'seller.descriptionPlaceholder',
                'Provide a reason for the customer (e.g. out of stock)',
              )}
              placeholderTextColor={theme.textSecondary}
              value={cancelReason}
              onChangeText={setCancelReason}
              maxLength={1000}
              editable={!isSubmitting}
              textAlignVertical="top"
              accessibilityLabel="Cancellation reason input"
            />

            {errorMessage != null ? (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                    borderColor: theme.danger,
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.cancelActionBtn,
                { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && !isSubmitting && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Keep item"
            >
              <Text style={[styles.cancelActionBtnText, { color: theme.text }]}>
                {t('orders.cancel', 'Keep Item')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={isSubmitting || cancelReason.length > 1000}
              style={({ pressed }) => [
                styles.confirmActionBtn,
                { backgroundColor: theme.danger },
                pressed && !isSubmitting && styles.buttonPressed,
                (isSubmitting || cancelReason.length > 1000) && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm cancellation"
            >
              {isSubmitting ? (
                <View style={styles.buttonInnerRow}>
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                  <Text style={[styles.confirmActionBtnText, { color: theme.onPrimary }]}>Cancelling...</Text>
                </View>
              ) : (
                <Text style={[styles.confirmActionBtnText, { color: theme.onPrimary }]}>
                  {t('seller.cancelItem', 'Confirm Cancel')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  outsidePress: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  body: {
    marginVertical: spacing.md,
  },
  warningMessage: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  itemSummary: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  productName: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
  },
  itemMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reasonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.text,
  },
  charCount: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  charCountOver: {
    color: colors.danger,
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    minHeight: 80,
    fontSize: typography.sm,
    color: colors.text,
  },
  textAreaError: {
    borderColor: colors.danger,
  },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelActionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  cancelActionBtnText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  confirmActionBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confirmActionBtnText: {
    color: colors.onPrimary,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  buttonInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
