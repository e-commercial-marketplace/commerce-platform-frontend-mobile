/**
 * Modal dialog for creating a seller shipment (Phase 4).
 *
 * Backend contracts & business rules:
 * - ONE SHIPMENT PER SELLER PER ORDER: Bundles all eligible confirmed items for the order
 *   to prevent partial shipments.
 * - Delivery methods:
 *   - PLATFORM_DELIVERY: carrierId is mandatory, selected from GET /seller/carriers.
 *   - SELF_DELIVERY: carrierId MUST be null; shop handles delivery directly.
 * - Non-empty orderItemIds array containing confirmed item IDs.
 * - Prevents duplicate submission while isSubmitting / isPending is true.
 * - In-flight query invalidation for seller order items and shipments on success.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { toApiError } from '../../api/errors';
import { colors, radii, spacing, typography } from '../../constants/theme';
import {
  useCreateSellerShipment,
  useSellerCarriers,
} from '../../hooks/useSellerFulfillment';
import type {
  DeliveryMethod,
  SellerOrderItem,
  ShipmentCreateRequest,
} from '../../types/sellerApi';
import { formatVND } from '../../utils/format';

export type CreateShipmentModalProps = {
  visible: boolean;
  orderId: string | null;
  items: SellerOrderItem[];
  onClose: () => void;
  onSuccess?: () => void;
  /** Optional custom submit handler (e.g. for testing) */
  onSubmitShipment?: (request: ShipmentCreateRequest) => Promise<unknown>;
};

export default function CreateShipmentModal({
  visible,
  orderId,
  items,
  onClose,
  onSuccess,
  onSubmitShipment,
}: CreateShipmentModalProps) {
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('PLATFORM_DELIVERY');
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load active carriers only when modal is visible and PLATFORM_DELIVERY is selected
  const carriersQuery = useSellerCarriers(visible && deliveryMethod === 'PLATFORM_DELIVERY');
  const carriers = carriersQuery?.data;
  const isLoadingCarriers = carriersQuery?.isLoading ?? false;
  const isCarriersError = carriersQuery?.isError ?? false;
  const refetchCarriers = carriersQuery?.refetch;

  const createShipmentMutation = useCreateSellerShipment();
  const isSubmitting = createShipmentMutation?.isPending ?? false;

  if (!orderId || !visible) {
    return null;
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + (Number.parseFloat(item.unitPrice) || 0) * item.quantity,
    0,
  );

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    setErrorMessage(null);
    setSelectedCarrierId(null);
    setDeliveryMethod('PLATFORM_DELIVERY');
    onClose();
  };

  const handleSelectDeliveryMethod = (method: DeliveryMethod) => {
    setDeliveryMethod(method);
    if (method === 'SELF_DELIVERY') {
      setSelectedCarrierId(null);
    }
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting || items.length === 0) {
      return;
    }

    if (deliveryMethod === 'PLATFORM_DELIVERY' && !selectedCarrierId) {
      setErrorMessage('Please select a carrier for platform delivery.');
      return;
    }

    setErrorMessage(null);

    const payload: ShipmentCreateRequest = {
      orderId,
      deliveryMethod,
      carrierId: deliveryMethod === 'PLATFORM_DELIVERY' ? selectedCarrierId : null,
      orderItemIds: items.map((i) => i.id),
    };

    try {
      if (onSubmitShipment) {
        await onSubmitShipment(payload);
      } else if (createShipmentMutation?.mutateAsync) {
        await createShipmentMutation.mutateAsync(payload);
      }

      // Reset local state
      setSelectedCarrierId(null);
      setDeliveryMethod('PLATFORM_DELIVERY');
      setErrorMessage(null);

      onSuccess?.();
      onClose();

      Alert.alert(
        'Shipment Created',
        `Shipment for Order #${orderId.slice(0, 8)} has been created successfully.`,
      );
    } catch (err) {
      const apiError = toApiError(err);
      let message = apiError.message;

      if (
        apiError.code === 'DUPLICATE_SHIPMENT' ||
        message.toLowerCase().includes('already has a shipment')
      ) {
        message = 'A shipment has already been created for this order.';
      } else if (apiError.status === 403) {
        message = 'You do not have permission to create a shipment for this order.';
      } else if (
        message.toLowerCase().includes('carrier') &&
        message.toLowerCase().includes('inactive')
      ) {
        message = 'The selected carrier is no longer active. Please choose another carrier.';
      }

      setErrorMessage(message);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    items.length === 0 ||
    (deliveryMethod === 'PLATFORM_DELIVERY' && (!selectedCarrierId || isLoadingCarriers));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSubmitting ? undefined : handleClose}
      testID="create-shipment-modal"
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
              <Text style={styles.title}>Create Shipment</Text>
              <Text style={styles.headerSubtitle}>
                Order #{orderId.slice(0, 8)} • {items.length} item{items.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close shipment creation dialog"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {/* One Shipment Policy Banner */}
            <View style={styles.policyNotice} testID="one-shipment-policy-banner">
              <Text style={styles.policyTitle}>One Shipment Policy</Text>
              <Text style={styles.policyText}>
                All {items.length} confirmed items in this order will be bundled into
                one shipment. Backend policy permits exactly ONE shipment per order.
              </Text>
            </View>

            {/* Bundled Items Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Bundled Items ({items.length})
              </Text>
              <View style={styles.itemsBox}>
                {items.map((item) => {
                  const unitPriceNum = Number.parseFloat(item.unitPrice) || 0;
                  const lineTotal = unitPriceNum * item.quantity;
                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text style={styles.itemMeta}>
                          Qty: {item.quantity} • {formatVND(unitPriceNum)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>{formatVND(lineTotal)}</Text>
                    </View>
                  );
                })}
                <View style={styles.bundleTotalRow}>
                  <Text style={styles.bundleTotalLabel}>Bundle Total:</Text>
                  <Text style={styles.bundleTotalValue}>{formatVND(totalAmount)}</Text>
                </View>
              </View>
            </View>

            {/* Delivery Method Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Method</Text>
              <View style={styles.methodSelector}>
                <Pressable
                  onPress={() => handleSelectDeliveryMethod('PLATFORM_DELIVERY')}
                  disabled={isSubmitting}
                  style={[
                    styles.methodOption,
                    deliveryMethod === 'PLATFORM_DELIVERY' && styles.methodOptionSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel="Platform Delivery"
                  accessibilityState={{ checked: deliveryMethod === 'PLATFORM_DELIVERY' }}
                >
                  <View style={styles.radioDot}>
                    {deliveryMethod === 'PLATFORM_DELIVERY' && (
                      <View style={styles.radioDotInner} />
                    )}
                  </View>
                  <View style={styles.methodOptionText}>
                    <Text
                      style={[
                        styles.methodTitle,
                        deliveryMethod === 'PLATFORM_DELIVERY' && styles.methodTitleSelected,
                      ]}
                    >
                      Platform Delivery
                    </Text>
                    <Text style={styles.methodDesc}>
                      Ship via integrated carrier
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleSelectDeliveryMethod('SELF_DELIVERY')}
                  disabled={isSubmitting}
                  style={[
                    styles.methodOption,
                    deliveryMethod === 'SELF_DELIVERY' && styles.methodOptionSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel="Self Delivery"
                  accessibilityState={{ checked: deliveryMethod === 'SELF_DELIVERY' }}
                >
                  <View style={styles.radioDot}>
                    {deliveryMethod === 'SELF_DELIVERY' && (
                      <View style={styles.radioDotInner} />
                    )}
                  </View>
                  <View style={styles.methodOptionText}>
                    <Text
                      style={[
                        styles.methodTitle,
                        deliveryMethod === 'SELF_DELIVERY' && styles.methodTitleSelected,
                      ]}
                    >
                      Self Delivery
                    </Text>
                    <Text style={styles.methodDesc}>
                      Delivered directly by shop
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Carrier Selection (PLATFORM_DELIVERY only) */}
            {deliveryMethod === 'PLATFORM_DELIVERY' ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Carrier *</Text>
                {isLoadingCarriers ? (
                  <View style={styles.loadingCarriersBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingCarriersText}>Loading active carriers…</Text>
                  </View>
                ) : isCarriersError ? (
                  <View style={styles.carriersErrorBox}>
                    <Text style={styles.carriersErrorText}>
                      Failed to load active carriers.
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (refetchCarriers) {
                          void refetchCarriers();
                        }
                      }}
                      style={styles.retryCarriersBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Retry loading carriers"
                    >
                      <Text style={styles.retryCarriersBtnText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : !carriers || carriers.length === 0 ? (
                  <View style={styles.emptyCarriersBox}>
                    <Text style={styles.emptyCarriersText}>
                      No active shipping carriers available. Please switch to Self Delivery.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.carriersList}>
                    {carriers.map((carrier) => {
                      const isSelected = selectedCarrierId === carrier.id;
                      return (
                        <Pressable
                          key={carrier.id}
                          onPress={() => {
                            if (!isSubmitting) {
                              setSelectedCarrierId(carrier.id);
                              setErrorMessage(null);
                            }
                          }}
                          disabled={isSubmitting}
                          style={[
                            styles.carrierItem,
                            isSelected && styles.carrierItemSelected,
                          ]}
                          accessibilityRole="radio"
                          accessibilityLabel={carrier.name}
                          accessibilityState={{ checked: isSelected }}
                          testID={`carrier-option-${carrier.id}`}
                        >
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioCircleSelected,
                            ]}
                          >
                            {isSelected && <View style={styles.radioCircleDot} />}
                          </View>
                          <Text
                            style={[
                              styles.carrierName,
                              isSelected && styles.carrierNameSelected,
                            ]}
                          >
                            {carrier.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              /* Self Delivery Explanatory Card */
              <View style={styles.selfDeliveryBox} testID="self-delivery-notice">
                <Text style={styles.selfDeliveryTitle}>Direct Shop Fulfillment</Text>
                <Text style={styles.selfDeliveryText}>
                  Your shop is directly responsible for delivering these items to the
                  customer. No third-party carrier will be assigned.
                </Text>
                <Text style={styles.selfDeliverySubtext}>
                  Ensure your fulfillment team coordinates delivery according to your shop's schedule.
                </Text>
              </View>
            )}

            {/* Error Message */}
            {errorMessage != null ? (
              <View style={styles.errorBox} testID="shipment-error-box">
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
              accessibilityLabel="Cancel shipment creation"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && !isSubmitDisabled && styles.btnPressed,
                isSubmitDisabled && styles.btnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm and Create Shipment"
            >
              {isSubmitting ? (
                <View style={styles.btnInnerRow}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                  <Text style={styles.submitBtnText}>Creating…</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Create Shipment</Text>
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
    maxWidth: 520,
    maxHeight: '90%',
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
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  body: {
    marginVertical: spacing.sm,
  },
  policyNotice: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  policyTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  policyText: {
    fontSize: typography.xs,
    color: colors.text,
    lineHeight: 16,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  itemsBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  itemMeta: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
  },
  bundleTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    marginTop: 2,
  },
  bundleTotalLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  bundleTotalValue: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  methodOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  methodOptionText: {
    flex: 1,
  },
  methodTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.text,
  },
  methodTitleSelected: {
    color: colors.primary,
  },
  methodDesc: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  loadingCarriersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  loadingCarriersText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  carriersErrorBox: {
    padding: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carriersErrorText: {
    fontSize: typography.xs,
    color: colors.danger,
    flex: 1,
  },
  retryCarriersBtn: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  retryCarriersBtnText: {
    color: colors.onPrimary,
    fontSize: typography.xs,
    fontWeight: '700',
  },
  emptyCarriersBox: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyCarriersText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  carriersList: {
    gap: spacing.xs,
  },
  carrierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  carrierItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioCircleDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  carrierName: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
  },
  carrierNameSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  selfDeliveryBox: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#16A34A',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  selfDeliveryTitle: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  selfDeliveryText: {
    fontSize: typography.xs,
    color: colors.text,
    lineHeight: 16,
  },
  selfDeliverySubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorBox: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
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
  submitBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  submitBtnText: {
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
