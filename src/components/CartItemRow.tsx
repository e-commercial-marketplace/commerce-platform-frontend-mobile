/**
 * One line in the server-backed cart: checkout selection, image, name, unit
 * price, quantity stepper, availability status and remove action.
 *
 * Identity is the cart-item id (`item.id`), never `productId`: PATCH, DELETE
 * and checkout all address the line by that id. The component stays purely
 * presentational — the screen wires callbacks to the `useCart` mutations and
 * owns the local checkout selection.
 *
 * A line may be unavailable (`!active`) or over stock
 * (`quantity > availableStock`). Such lines stay visible and removable but
 * cannot be increased; decrement is only blocked while the product itself is
 * inactive or the quantity is already 1 (the backend refuses PATCH to 0).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';
import type { CartLine } from '../types/cart';
import { formatVND } from '../utils/format';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';

type CartItemRowProps = {
  item: CartLine;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  /** Whether this purchasable line is part of the checkout selection. */
  selected?: boolean;
  /** Toggles this line in the local checkout selection. */
  onToggleSelected?: () => void;
  /** Disables every control (another cart mutation is in flight). */
  disabled?: boolean;
};

export default function CartItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  selected = false,
  onToggleSelected,
  disabled = false,
}: CartItemRowProps) {
  const { quantity, active, availableStock } = item;

  const canDecrease = active && quantity > 1 && !disabled;
  const canIncrease = active && quantity < availableStock && !disabled;
  const canRemove = !disabled;
  const canSelect = item.available && !disabled;
  const showControls = active;

  const status = getStatusLabel(item);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable
          onPress={onToggleSelected}
          disabled={!canSelect}
          style={({ pressed }) => [
            styles.selection,
            selected && canSelect && styles.selectionChecked,
            !canSelect && styles.selectionDisabled,
            pressed && canSelect && styles.pressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityLabel={
            item.available
              ? `${selected ? 'Deselect' : 'Select'} ${item.name}`
              : `${item.name} is unavailable for checkout`
          }
          accessibilityState={{ checked: selected, disabled: !canSelect }}
        >
          {selected && <Text style={styles.selectionMark}>✓</Text>}
        </Pressable>

        <ProductImage source={item.image} style={styles.thumb} />

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>

          <PriceDisplay price={item.unitPrice} size="sm" />

          <Text style={[styles.status, !item.available && styles.statusUnavailable]}>{status}</Text>

          <View style={styles.actions}>
            {showControls && (
              <View style={styles.stepper}>
                <Pressable
                  onPress={onDecrease}
                  disabled={!canDecrease}
                  style={({ pressed }) => [
                    styles.stepButton,
                    !canDecrease && styles.stepButtonDisabled,
                    pressed && canDecrease && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease quantity of ${item.name}`}
                  accessibilityState={{ disabled: !canDecrease }}
                >
                  <Text style={styles.stepSymbol}>−</Text>
                </Pressable>

                <Text style={styles.quantity}>{quantity}</Text>

                <Pressable
                  onPress={onIncrease}
                  disabled={!canIncrease}
                  style={({ pressed }) => [
                    styles.stepButton,
                    !canIncrease && styles.stepButtonDisabled,
                    pressed && canIncrease && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Increase quantity of ${item.name}`}
                  accessibilityState={{ disabled: !canIncrease }}
                >
                  <Text style={styles.stepSymbol}>+</Text>
                </Pressable>
              </View>
            )}

            <Pressable
              onPress={onRemove}
              disabled={!canRemove}
              style={({ pressed }) => [
                styles.removeButton,
                pressed && canRemove && styles.pressed,
                !canRemove && styles.removeButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name} from cart`}
              accessibilityState={{ disabled: !canRemove }}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.lineTotal}>
        {quantity} × {formatVND(item.unitPrice)}
      </Text>
    </View>
  );
}

/**
 * Human-readable availability. Mirrors the backend rules: a line is
 * purchasable only when the product is active and quantity <= availableStock.
 */
function getStatusLabel(item: CartLine): string {
  if (!item.active) {
    return 'Unavailable';
  }
  if (item.availableStock === 0) {
    return 'Out of stock';
  }
  if (item.quantity > item.availableStock) {
    return `Only ${item.availableStock} left in stock`;
  }
  return `${item.availableStock} available`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selection: {
    width: 24,
    height: 24,
    marginTop: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  selectionDisabled: {
    opacity: 0.35,
  },
  selectionMark: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  status: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusUnavailable: {
    color: colors.danger,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  quantity: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  removeButton: {
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  removeButtonDisabled: {
    opacity: 0.4,
  },
  removeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  lineTotal: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.75,
  },
});
