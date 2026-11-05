/**
 * Formats and displays a product price in VND. When an original (pre-sale)
 * price exists it is shown struck through next to the current price.
 * Fully theme-aware with dynamic semantic tokens for Light and Dark modes.
 */

import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '../constants/theme';
import { useAppTheme } from '../theme';
import { formatVND } from '../utils/format';

type PriceDisplayProps = {
  /** Current price in VND. */
  price: number;
  /** Pre-discount price in VND; shown struck through when higher than price. */
  originalPrice?: number;
  /** Visual size for different contexts (cards vs. detail). */
  size?: 'sm' | 'md' | 'lg';
};

const PRICE_FONT_SIZE = { sm: 15, md: 17, lg: 24 } as const;

export default function PriceDisplay({ price, originalPrice, size = 'md' }: PriceDisplayProps) {
  const showOriginal = originalPrice !== undefined && originalPrice > price;
  const { theme } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.price, { fontSize: PRICE_FONT_SIZE[size], color: theme.primary }]}>
        {formatVND(price)}
      </Text>
      {showOriginal && (
        <Text
          style={[
            styles.original,
            { fontSize: Math.max(11, PRICE_FONT_SIZE[size] - 4), color: theme.textSecondary },
          ]}
        >
          {formatVND(originalPrice)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  price: {
    fontWeight: '700',
  },
  original: {
    textDecorationLine: 'line-through',
  },
});
