/**
 * One line in the cart list: product image, name, unit price, quantity
 * stepper and remove action. Pure presentation — the screen wires the
 * callbacks to the shared cart state, matching ProductCard's callback
 * pattern. The decrease button is disabled while quantity is 1 so a line
 * can never be driven below 1 by accident (removal is an explicit action).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';
import type { CartItem } from '../types/cart';
import { formatVND } from '../utils/format';
import PriceDisplay from './PriceDisplay';
import ProductImage from './ProductImage';

type CartItemRowProps = {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

export default function CartItemRow({ item, onIncrease, onDecrease, onRemove }: CartItemRowProps) {
  const { product, quantity } = item;
  const canDecrease = quantity > 1;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <ProductImage source={product.image} style={styles.thumb} />

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="sm" />

          <View style={styles.actions}>
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
                accessibilityLabel={`Decrease quantity of ${product.name}`}
                accessibilityState={{ disabled: !canDecrease }}
              >
                <Text style={styles.stepSymbol}>−</Text>
              </Pressable>

              <Text style={styles.quantity}>{quantity}</Text>

              <Pressable
                onPress={onIncrease}
                style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Increase quantity of ${product.name}`}
              >
                <Text style={styles.stepSymbol}>+</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onRemove}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${product.name} from cart`}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.lineTotal}>
        {quantity} × {formatVND(product.price)}
      </Text>
    </View>
  );
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
