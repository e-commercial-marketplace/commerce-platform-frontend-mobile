/**
 * Update Product Stock Modal component.
 *
 * Dedicated dialog for updating the absolute inventory level of a seller's product.
 * - Displays product name & current stock
 * - Accepts new ABSOLUTE stock value (e.g. current = 10, entering 15 sets stock to 15)
 * - Validates: required, integer only, non-negative (>= 0), accepts 0
 * - Handles pending/loading state to prevent duplicate submissions
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radii, spacing, typography } from '../../constants/theme';
import type { ProductSummaryDto } from '../../types/sellerProductApi';
import Button from '../Button';

export type UpdateProductStockModalProps = {
  visible: boolean;
  product?: ProductSummaryDto | null;
  productName?: string;
  currentStock?: number;
  pending?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onSave: (newStock: number) => void;
};

export default function UpdateProductStockModal({
  visible,
  product,
  productName: propProductName,
  currentStock: propCurrentStock,
  pending = false,
  loading = false,
  onCancel,
  onSave,
}: UpdateProductStockModalProps) {
  const isBusy = pending || loading;

  const displayName = product?.name ?? propProductName ?? 'Product';
  const effectiveCurrentStock = product?.stock ?? propCurrentStock ?? 0;

  const [stockInput, setStockInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStockInput(String(effectiveCurrentStock));
      setErrorMessage(null);
    }
  }, [visible, effectiveCurrentStock]);

  const validate = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setErrorMessage('Stock is required.');
      return null;
    }

    // Must be integer: reject decimals, scientific notation, or non-numeric
    if (!/^-?\d+$/.test(trimmed)) {
      setErrorMessage('Stock must be a whole number.');
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed)) {
      setErrorMessage('Stock must be a whole number.');
      return null;
    }

    if (parsed < 0) {
      setErrorMessage('Stock must be 0 or greater.');
      return null;
    }

    setErrorMessage(null);
    return parsed;
  };

  const handleInputChange = (text: string) => {
    setStockInput(text);
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSave = () => {
    if (isBusy) {
      return;
    }

    const validatedStock = validate(stockInput);
    if (validatedStock === null) {
      return;
    }

    onSave(validatedStock);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isBusy ? undefined : onCancel}
      testID="update-product-stock-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          style={styles.dismissOverlay}
          onPress={isBusy ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal backdrop"
        />

        <View style={styles.card} testID="update-stock-modal-card">
          <Text style={styles.title}>Update Stock</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Product:</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Current stock:</Text>
            <Text style={styles.currentStockValue}>{effectiveCurrentStock}</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>New Stock Quantity (Absolute)</Text>
            <TextInput
              value={stockInput}
              onChangeText={handleInputChange}
              keyboardType="number-pad"
              placeholder="e.g. 25"
              placeholderTextColor={colors.textSecondary}
              editable={!isBusy}
              style={[
                styles.input,
                errorMessage ? styles.inputError : null,
                isBusy ? styles.inputDisabled : null,
              ]}
              accessibilityLabel="New stock quantity input"
              testID="update-stock-input"
            />
            {errorMessage ? (
              <Text style={styles.errorText} testID="update-stock-error">
                {errorMessage}
              </Text>
            ) : null}
            <Text style={styles.hintText}>
              Enter the exact count currently in inventory.
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={isBusy}
              style={styles.actionBtn}
              accessibilityLabel="Cancel stock update"
            />
            <Button
              title="Save"
              variant="primary"
              onPress={handleSave}
              disabled={isBusy}
              loading={isBusy}
              style={styles.actionBtn}
              accessibilityLabel="Save stock update"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  productName: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  currentStockValue: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
  },
  inputSection: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    fontSize: typography.base,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: typography.xs,
    color: colors.danger,
    marginTop: 2,
  },
  hintText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
