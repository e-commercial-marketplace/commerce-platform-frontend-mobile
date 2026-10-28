/**
 * Modal dialog for transitioning Seller Shipment status (Phase 5).
 *
 * Implements:
 * - Tracking code entry for SHIPPED transition (required, trimmed, preserves input on failure)
 * - Confirmation flow for significant actions (CANCELLED, FAILED, RETURNED, DELIVERED, PREPARING)
 * - Double-submission prevention while in flight
 * - Backend business error surface (e.g. paid order cancellation, invalid transitions)
 * - Clear multi-seller aggregation explanations
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
import type { SellerShipment, ShipmentStatus } from '../../types/sellerApi';

export type UpdateShipmentStatusModalProps = {
  visible: boolean;
  shipment: SellerShipment | null;
  targetStatus: ShipmentStatus | null;
  onClose: () => void;
  onConfirm: (
    shipmentId: string,
    status: ShipmentStatus,
    trackingCode?: string,
  ) => Promise<void>;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export default function UpdateShipmentStatusModal({
  visible,
  shipment,
  targetStatus,
  onClose,
  onConfirm,
  isSubmitting = false,
  errorMessage = null,
}: UpdateShipmentStatusModalProps) {
  const [trackingCode, setTrackingCode] = useState('');

  if (!visible || !shipment || !targetStatus) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    setTrackingCode('');
    onClose();
  };

  const handleConfirmAction = () => {
    if (isSubmitting) {
      return;
    }

    if (targetStatus === 'SHIPPED') {
      const trimmed = trackingCode.trim();
      if (!trimmed) {
        return;
      }
      void onConfirm(shipment.id, 'SHIPPED', trimmed);
    } else {
      void onConfirm(shipment.id, targetStatus);
    }
  };

  const isSubmitDisabled =
    isSubmitting || (targetStatus === 'SHIPPED' && trackingCode.trim().length === 0);

  const renderContent = () => {
    switch (targetStatus) {
      case 'SHIPPED':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tracking Information Required</Text>
            <Text style={styles.sectionDescription}>
              Please enter the tracking code or dispatch reference number for this shipment.
            </Text>

            <Text style={styles.fieldLabel}>Tracking Code *</Text>
            <TextInput
              style={[
                styles.textInput,
                errorMessage != null && styles.textInputError,
              ]}
              value={trackingCode}
              onChangeText={setTrackingCode}
              placeholder="e.g. GHN12345678VN"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isSubmitting}
              testID="tracking-code-input"
              accessibilityLabel="Tracking code input"
            />
          </View>
        );

      case 'CANCELLED':
        return (
          <View style={styles.section}>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Cancel Entire Shipment</Text>
              <Text style={styles.warningText}>
                Are you sure you want to cancel this shipment? All {shipment.items?.length ?? 0}{' '}
                bundled order items will be cancelled and stock will be restored to your
                inventory.
              </Text>
              <Text style={styles.warningSubtext}>
                Note: Backend strictly forbids seller cancellation for paid orders.
              </Text>
            </View>
          </View>
        );

      case 'DELIVERED':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm Delivery</Text>
            <Text style={styles.sectionDescription}>
              Confirm that this shipment has been successfully delivered to the customer.
            </Text>
            <Text style={styles.helperText}>
              Backend will record COD payment completion and mark the customer order DELIVERED
              once all shop shipments for this order are complete.
            </Text>
          </View>
        );

      case 'FAILED':
        return (
          <View style={styles.section}>
            <View style={styles.dangerAlertBox}>
              <Text style={styles.dangerAlertTitle}>Mark Delivery as Failed</Text>
              <Text style={styles.dangerAlertText}>
                Confirm that delivery of this shipment could not be completed. The items will
                remain in failed state until they arrive back at your shop.
              </Text>
            </View>
          </View>
        );

      case 'RETURNED':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm Items Returned</Text>
            <Text style={styles.sectionDescription}>
              Confirm that the returned package has arrived at your shop or warehouse.
            </Text>
            <Text style={styles.helperText}>
              Backend will automatically restore inventory stock for all items in this shipment.
            </Text>
          </View>
        );

      case 'PREPARING':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Preparing</Text>
            <Text style={styles.sectionDescription}>
              Move this shipment to the PREPARING stage to signal that your team is packing the
              items for dispatch.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  const getActionLabel = () => {
    switch (targetStatus) {
      case 'SHIPPED':
        return 'Confirm Shipped';
      case 'CANCELLED':
        return 'Confirm Cancel Shipment';
      case 'DELIVERED':
        return 'Confirm Delivered';
      case 'FAILED':
        return 'Confirm Failed';
      case 'RETURNED':
        return 'Confirm Returned';
      case 'PREPARING':
        return 'Start Preparing';
      default:
        return 'Confirm';
    }
  };

  const isDestructive = targetStatus === 'CANCELLED' || targetStatus === 'FAILED';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : handleClose}
      testID="update-shipment-status-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          style={styles.outsidePress}
          onPress={isSubmitting ? undefined : handleClose}
        />
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Update Shipment Status</Text>
              <Text style={styles.headerSubtitle}>
                Order #{shipment.orderId.slice(0, 8)} • Shipment #{shipment.id.slice(0, 8)}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close status update modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {renderContent()}

            {/* Error Message Box */}
            {errorMessage != null ? (
              <View style={styles.errorBox} testID="status-update-error-box">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && !isSubmitting && styles.btnPressed,
                isSubmitting && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel status update"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirmAction}
              disabled={isSubmitDisabled}
              style={({ pressed }) => [
                styles.confirmBtn,
                isDestructive && styles.confirmBtnDestructive,
                pressed && !isSubmitDisabled && styles.btnPressed,
                isSubmitDisabled && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={getActionLabel()}
              testID="confirm-status-update-btn"
            >
              {isSubmitting ? (
                <View style={styles.btnInnerRow}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                  <Text style={styles.confirmBtnText}>Updating…</Text>
                </View>
              ) : (
                <Text style={styles.confirmBtnText}>{getActionLabel()}</Text>
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
    alignItems: 'flex-start',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  body: {
    marginVertical: spacing.md,
  },
  section: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: typography.sm,
    color: colors.text,
    minHeight: 44,
  },
  textInputError: {
    borderColor: colors.danger,
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  warningTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  warningText: {
    fontSize: typography.xs,
    color: colors.text,
    lineHeight: 18,
  },
  warningSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  dangerAlertBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  dangerAlertTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 2,
  },
  dangerAlertText: {
    fontSize: typography.xs,
    color: colors.text,
    lineHeight: 18,
  },
  helperText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.xs,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
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
  cancelBtnText: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  confirmBtnDestructive: {
    backgroundColor: colors.danger,
  },
  confirmBtnText: {
    color: colors.onPrimary,
    fontSize: typography.sm,
    fontWeight: '700',
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
