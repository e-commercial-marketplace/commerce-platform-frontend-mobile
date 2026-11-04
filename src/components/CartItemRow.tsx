/**
 * One line in the server-backed cart: checkout selection, image, name, unit
 * price, quantity stepper, availability status and remove action.
 *
 * Identity is the cart-item id (`item.id`), never `productId`: PATCH, DELETE
 * and checkout all address the line by that id. The component stays purely
 * presentational — the screen wires callbacks to the `useCart` mutations and
 * owns the local checkout selection.
 *
 * Fully theme-aware with dynamic semantic tokens and localized strings.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing } from '../constants/theme';
import { useAppLanguage } from '../i18n';
import { useAppTheme } from '../theme';
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
  const { theme } = useAppTheme();
  const { t } = useAppLanguage();
  const { quantity, active, availableStock } = item;

  const canDecrease = active && quantity > 1 && !disabled;
  const canIncrease = active && quantity < availableStock && !disabled;
  const canRemove = !disabled;
  const canSelect = item.available && !disabled;
  const showControls = active;

  const status = getStatusLabel(item, t);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.top}>
        <Pressable
          onPress={onToggleSelected}
          disabled={!canSelect}
          style={({ pressed }) => [
            styles.selection,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
            selected && canSelect && {
              borderColor: theme.primary,
              backgroundColor: theme.primary,
            },
            !canSelect && styles.selectionDisabled,
            pressed && canSelect && styles.pressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityLabel={
            item.available
              ? selected
                ? t('cart.deselectItem', `Deselect ${item.name}`, { name: item.name })
                : t('cart.selectItem', `Select ${item.name}`, { name: item.name })
              : t('cart.unavailableForCheckout', `${item.name} is unavailable for checkout`, {
                  name: item.name,
                })
          }
          accessibilityState={{ checked: selected, disabled: !canSelect }}
        >
          {selected && <Text style={styles.selectionMark}>✓</Text>}
        </Pressable>

        <ProductImage source={item.image} style={styles.thumb} />

        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
            {item.name}
          </Text>

          <PriceDisplay price={item.unitPrice} size="sm" />

          <Text
            style={[
              styles.status,
              { color: theme.textSecondary },
              !item.available && { color: theme.danger, fontWeight: '600' },
            ]}
          >
            {status}
          </Text>

          <View style={styles.actions}>
            {showControls && (
              <View
                style={[
                  styles.stepper,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Pressable
                  onPress={onDecrease}
                  disabled={!canDecrease}
                  style={({ pressed }) => [
                    styles.stepButton,
                    !canDecrease && styles.stepButtonDisabled,
                    pressed && canDecrease && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'cart.decreaseQuantity',
                    `Decrease quantity of ${item.name}`,
                    { name: item.name },
                  )}
                  accessibilityState={{ disabled: !canDecrease }}
                >
                  <Text style={[styles.stepSymbol, { color: theme.text }]}>−</Text>
                </Pressable>

                <Text style={[styles.quantity, { color: theme.text }]}>{quantity}</Text>

                <Pressable
                  onPress={onIncrease}
                  disabled={!canIncrease}
                  style={({ pressed }) => [
                    styles.stepButton,
                    !canIncrease && styles.stepButtonDisabled,
                    pressed && canIncrease && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'cart.increaseQuantity',
                    `Increase quantity of ${item.name}`,
                    { name: item.name },
                  )}
                  accessibilityState={{ disabled: !canIncrease }}
                >
                  <Text style={[styles.stepSymbol, { color: theme.text }]}>+</Text>
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
              accessibilityLabel={t('cart.removeFromCart', `Remove ${item.name} from cart`, {
                name: item.name,
              })}
              accessibilityState={{ disabled: !canRemove }}
            >
              <Text style={[styles.removeText, { color: theme.danger }]}>
                {t('cart.remove', 'Remove')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={[styles.lineTotal, { color: theme.textSecondary }]}>
        {quantity} × {formatVND(item.unitPrice)}
      </Text>
    </View>
  );
}

/**
 * Human-readable availability. Mirrors the backend rules: a line is
 * purchasable only when the product is active and quantity <= availableStock.
 */
function getStatusLabel(
  item: CartLine,
  t: (key: string, def?: string, options?: Record<string, unknown>) => string,
): string {
  if (!item.active) {
    return t('cart.unavailable', 'Unavailable');
  }
  if (item.availableStock === 0) {
    return t('cart.outOfStock', 'Out of stock');
  }
  if (item.quantity > item.availableStock) {
    return t('cart.onlyLeftInStock', `Only ${item.availableStock} left in stock`, {
      count: item.availableStock,
    });
  }
  return t('cart.stockAvailable', `${item.availableStock} available`, {
    count: item.availableStock,
  });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionDisabled: {
    opacity: 0.35,
  },
  selectionMark: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },
  status: {
    fontSize: 12,
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
    borderRadius: radii.pill,
    borderWidth: 1,
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
  },
  quantity: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
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
  },
  lineTotal: {
    fontSize: 12,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.75,
  },
});
